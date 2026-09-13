import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function rebuildFts() {
  await prisma.$executeRawUnsafe(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      article_id UNINDEXED,
      title,
      content,
      tags,
      category,
      tokenize = 'unicode61'
    );
  `);
  await prisma.$executeRawUnsafe(`DELETE FROM knowledge_fts;`);
  const articles = await prisma.knowledgeArticle.findMany();
  for (const article of articles) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO knowledge_fts (article_id, title, content, tags, category) VALUES (?, ?, ?, ?, ?)`,
      article.id,
      article.title,
      article.content,
      article.tags,
      article.category,
    );
  }
}

const SAMPLE = true;

async function main() {
  const ifEmpty = process.argv.includes("--if-empty");
  if (ifEmpty) {
    const count = await prisma.product.count();
    if (count > 0) {
      console.log("数据库已有数据，跳过种子。");
      return;
    }
  }

  await prisma.appSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      companyName: "GardenTec / Farm Boxer",
      productName: "FarmBoxer WhatsApp 经营中台",
      currentSalesRmb: 15_000_000,
      targetSalesRmb: 1_000_000_000,
      targetYears: 5,
      marginFloorPercent: 15,
      autoReplyEnabled: false,
      autoReplyConfidenceThreshold: 0.82,
      waVerifyToken: process.env.WA_VERIFY_TOKEN || "farmboxer-demo-verify",
    },
    update: {},
  });

  const products = [
    {
      name: "FarmBoxer 9ZT-0.6 铡草机",
      sku: "FB-9ZT-0.6",
      category: "铡草机",
      listPrice: 1280,
      floorPrice: 980,
      cost: 720,
      targetMarkets: "肯尼亚,尼日利亚,坦桑尼亚,乌干达,加纳,越南",
      solutionTags: "铡草,chaff cutter,9ZT-0.6,牛羊饲料,小型牧场,鲜草,干草",
      specsJson: JSON.stringify({
        model: "9ZT-0.6",
        powerKw: 2.2,
        voltage: "220V/50Hz",
        motor: "YL100L2-2",
        drumRpm: 860,
        weightKg: 42,
        capacityFreshKgH: 600,
        capacityDryKgH: 450,
        dimensionsMm: "850x420x810",
        altEngine: "GG170 4.1HP",
        disclaimer: "参数来自公开同类机型整理，样本目录非正式企标。",
      }),
      configsJson: JSON.stringify(["电机 2.2kW", "汽油机 GG170", "刀片加长套装"]),
    },
    {
      name: "FarmBoxer 9ZT-1.2 中型铡草机",
      sku: "FB-9ZT-1.2",
      category: "铡草机",
      listPrice: 2680,
      floorPrice: 2100,
      cost: 1580,
      targetMarkets: "肯尼亚,尼日利亚,埃塞俄比亚,巴西",
      solutionTags: "中型牧场,高产能,铡草,合作社",
      specsJson: JSON.stringify({
        model: "9ZT-1.2",
        powerKw: 3.0,
        capacityFreshKgH: 1200,
        note: "样本机型，用于匹配演示。",
      }),
      configsJson: JSON.stringify(["3kW 电机", "输送带喂入"]),
    },
    {
      name: "FarmBoxer 9Z-6A 铡草揉丝机",
      sku: "FB-9Z-6A",
      category: "揉丝机",
      listPrice: 8900,
      floorPrice: 7600,
      cost: 5400,
      targetMarkets: "肯尼亚,坦桑尼亚,中国",
      solutionTags: "揉丝,青贮,规模化奶牛,方案配置",
      specsJson: JSON.stringify({ model: "9Z-6A", capacityTph: 6, note: "样本" }),
      configsJson: JSON.stringify(["青贮刀组", "柴油机配套"]),
    },
    {
      name: "FarmBoxer 9FQ-50 饲料粉碎机",
      sku: "FB-9FQ-50",
      category: "粉碎机",
      listPrice: 1560,
      floorPrice: 1180,
      cost: 860,
      targetMarkets: "尼日利亚,加纳,越南,菲律宾",
      solutionTags: "粉碎,玉米芯,精料,配套",
      specsJson: JSON.stringify({ model: "9FQ-50", powerKw: 2.2, note: "样本" }),
      configsJson: JSON.stringify(["锤片", "筛网 2mm/4mm"]),
    },
    {
      name: "奶牛场起步方案包（铡草+粉碎+备件）",
      sku: "FB-KIT-DAIRY",
      category: "方案包",
      listPrice: 4200,
      floorPrice: 3600,
      cost: 2480,
      targetMarkets: "肯尼亚,坦桑尼亚,乌干达",
      solutionTags: "方案配置,奶牛,经销商,整包,售后",
      specsJson: JSON.stringify({
        includes: ["FB-9ZT-0.6", "FB-9FQ-50", "刀片*4", "皮带*2"],
        note: "样本方案，用于提高客单与毛利。",
      }),
      configsJson: JSON.stringify(["标准包", "含一年易损件"]),
    },
    {
      name: "亏损演示机（禁止自动推荐）",
      sku: "FB-DEMO-LOWMARGIN",
      category: "铡草机",
      listPrice: 800,
      floorPrice: 760,
      cost: 750,
      targetMarkets: "全球",
      solutionTags: "低价,促销,演示用低于毛利底线",
      specsJson: JSON.stringify({ note: "故意低于 15% 毛利，用于测试匹配降权。" }),
      configsJson: JSON.stringify([]),
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      create: { ...p, isSample: SAMPLE },
      update: { ...p, isSample: SAMPLE },
    });
  }

  const articles = [
    {
      title: "【样本】9ZT-0.6 产品参数与适用场景",
      category: "产品参数",
      tags: "9ZT-0.6,铡草机,参数,FarmBoxer",
      content:
        "【样本内容，非正式企标】FarmBoxer / GardenTec 风格 9ZT-0.6 铡草机：2.2kW / 220V 电机，鼓转速约 860r/min，鲜草产能约 600kg/h，干草约 450kg/h，主机约 42kg。可改配 GG170 汽油机（约 4.1HP）。适合家庭养牛羊、小型牧场切玉米秸、稻草、麦秸。切长可调约 10–25mm。对比更大的 9ZT-1.2，0.6 型对高韧性稻草更灵活，但不是规模化青贮主力。",
    },
    {
      title: "【样本】报价话术：守住 15% 毛利",
      category: "报价话术",
      tags: "报价,毛利,15%,话术,FOB",
      content:
        "【样本话术】对外可以谈配置、电压、港口和配件，但不能把价格谈到毛利 15% 以下。话术：'We can adjust motor/petrol and spare parts, but we do not sell below our margin floor — it would break spare-parts support.' 中文：可以配电机或汽油机，也可以做方案包提高客单，禁止以亏损价换销量。若客户只要最低价，引导到方案包 FB-KIT-DAIRY 而不是 FB-DEMO-LOWMARGIN。",
    },
    {
      title: "【样本】刀片与皮带售后",
      category: "售后",
      tags: "售后,刀片,皮带,配件",
      content:
        "【样本售后】刀片属易损件，按饲养强度建议 1–3 个月检查。更换时断电/停机，保持动刀数量与原厂一致（常见 2 片）。皮带打滑先查张紧再换件。质保话术可承诺主机结构问题协商，消耗件单独报价且仍须满足毛利底线。",
    },
    {
      title: "【样本】竞品对照：同门 9ZT 杂牌与本地焊机",
      category: "竞品",
      tags: "竞品,9ZT,低价",
      content:
        "【样本竞品】市场上大量贴牌 9ZT-0.6，公开零售从东非 KES 2.5 万档到印度折扣价不等。本地作坊焊机更便宜但不稳定。FarmBoxer 不应拼地板价，应拼：齐套配件、电压匹配、可修结构和 24h WhatsApp 响应。发现对手破价，记录情报，不要跟降。",
    },
    {
      title: "【样本】肯尼亚电压与渠道偏好",
      category: "市场情报",
      tags: "肯尼亚,220V,经销商",
      content:
        "【样本情报】肯尼亚询盘常见 220V/50Hz；无电牧场要汽油机。经销商关心备件不断档。本地零售带可见 9ZT-0.6 约 KES 25,000 量级（公开网页，非我司成交）。出厂侧必须按人民币成本核算 ≥15% 毛利后再换汇。",
    },
    {
      title: "【样本】奶牛场方案配置",
      category: "方案配置",
      tags: "方案配置,奶牛,KIT-DAIRY",
      content:
        "【样本方案】10–30 头奶牛起步：1 台 9ZT-0.6 + 1 台 9FQ-50 + 刀片/皮带年包。先问牛只数量、现有电压、主要饲草（鲜玉米秸还是干草）。规模到 50 头以上再升 9ZT-1.2 或揉丝机。方案包毛利通常优于单机促销。",
    },
  ];

  for (const a of articles) {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { title: a.title } });
    if (existing) {
      await prisma.knowledgeArticle.update({
        where: { id: existing.id },
        data: { ...a, language: "zh-CN", source: "seed", isSample: SAMPLE },
      });
    } else {
      await prisma.knowledgeArticle.create({
        data: { ...a, language: "zh-CN", source: "seed", isSample: SAMPLE },
      });
    }
  }

  const contacts = [
    {
      phone: "254711000001",
      name: "Peter Mwangi",
      country: "肯尼亚",
      countryCode: "KE",
      needs: "Need 9ZT-0.6 chaff cutter for 15 dairy cows, 220V",
      tier: "B",
      stage: "qualified",
      productNotes: "FB-9ZT-0.6",
    },
    {
      phone: "234801000002",
      name: "Chinedu Okonkwo",
      country: "尼日利亚",
      countryCode: "NG",
      needs: "Wholesale petrol chaff cutter for dealers, want low price",
      tier: "A",
      stage: "quoted",
      productNotes: "FB-9ZT-0.6, FB-KIT-DAIRY",
    },
    {
      phone: "255754000003",
      name: "Amina Yusuf",
      country: "坦桑尼亚",
      countryCode: "TZ",
      needs: "刀片更换售后，9ZT-0.6 用了半年",
      tier: "C",
      stage: "new",
      productNotes: "FB-9ZT-0.6",
    },
  ];

  for (const c of contacts) {
    await prisma.contact.upsert({
      where: { phone: c.phone },
      create: c,
      update: c,
    });
  }

  const peter = await prisma.contact.findUniqueOrThrow({ where: { phone: "254711000001" } });
  const existingMsg = await prisma.conversation.findFirst({
    where: { contactId: peter.id, waMessageId: "seed-in-1" },
  });
  if (!existingMsg) {
    await prisma.conversation.create({
      data: {
        contactId: peter.id,
        waMessageId: "seed-in-1",
        direction: "inbound",
        body: "Hi, do you have 9ZT-0.6 chaff cutter for dairy farm in Kenya? 220V please.",
        status: "read",
      },
    });
  }

  const intel = [
    {
      country: "肯尼亚",
      localConfigPrefs: "【样本】220V/50Hz；无电牧场要汽油机；切长 10–25mm。",
      priceBands: "【样本】本地零售常见约 KES 25,000 档，非正式成交。",
      competitors: "【样本】印度 GT 系、中国贴牌 9ZT、本地组装。",
      source: "adapter:seed",
      status: "pending",
      notes: "种子情报，待批准入库。",
      isSample: true,
    },
    {
      country: "尼日利亚",
      localConfigPrefs: "【样本】电网不稳，偏好汽油/柴油。",
      priceBands: "【样本】经销商要阶梯价，禁止破毛利底线。",
      competitors: "【样本】作坊焊机 + 跨境低价机。",
      source: "adapter:seed",
      status: "pending",
      notes: "种子情报。",
      isSample: true,
    },
  ];
  for (const row of intel) {
    const found = await prisma.marketFinding.findFirst({
      where: { country: row.country, source: row.source, notes: row.notes },
    });
    if (!found) await prisma.marketFinding.create({ data: row });
  }

  await rebuildFts();
  console.log("种子数据已写入（均为样本/演示，已标注）。");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
