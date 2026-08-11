export type ToolId = 'weekly' | 'review' | 'exam' | 'exercises' | 'essay' | 'chat' | 'macro';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: (
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  )[];
}

export interface PlanningInput {
  grade: string;
  discipline?: string;
  theme?: string;
  pages?: string;
  classesCount?: string;
  contents: string;
  include?: string;
  avoid?: string;
  weeksCount?: string;
  concept?: string;
  attachments?: {
    data: string;
    mimeType: string;
    fileComment?: string;
  }[];
}

export async function generatePlanning(toolId: ToolId, input: PlanningInput, refinement?: string, previousOutput?: string): Promise<string> {
  const response = await fetch('/api/generate-planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId, input, refinement, previousOutput }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'Erro ao gerar conteúdo');
  }
  const data = await response.json();
  return data.result;
}

export async function sendChatMessage(messages: ChatMessage[], memories?: string[]): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, memories }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || 'Erro ao gerar resposta no chat');
  }
  const data = await response.json();
  return data.result;
}
