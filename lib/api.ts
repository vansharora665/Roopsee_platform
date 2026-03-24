import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    const status = error.message.toLowerCase().includes("not found") ? 404 : 500;

    return NextResponse.json(
      {
        error: error.message
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      error: "Unexpected server error"
    },
    { status: 500 }
  );
}
