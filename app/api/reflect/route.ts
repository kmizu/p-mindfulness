import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { reflectionTurn } from '@/lib/agents/reflection';
import { getUserMemory } from '@/lib/db/queries';

const ReflectSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['agent', 'user']),
      content: z.string(),
    })
  ),
  locale: z.enum(['en', 'ja']).optional().default('en'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, locale } = ReflectSchema.parse(body);

    const memory = await getUserMemory();
    const hasHistory = (memory?.sessionCount ?? 0) > 0;

    const result = await reflectionTurn(messages, locale, hasHistory, memory);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    console.error('[reflect] Error:', err);
    return NextResponse.json({ success: false, error: 'Reflection failed' }, { status: 500 });
  }
}
