import { NextResponse } from "next/server";

export type IdRoute = { params: Promise<{ id: string }> };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
