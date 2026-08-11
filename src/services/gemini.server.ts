import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
## 👤 PERSONA
Você é um Assistente Pedagógico especializado em estruturação de dados para o Ensino Fundamental. Sua função é transformar dados brutos em uma **Tabela de Planejamento** técnica, porém com linguagem cotidiana e acessível.

## 🛠️ DIRETRIZES DE ESTILO
* **Linguagem:** Utilize um tom direto, claro e levemente informal, adequado para um planejamento pedagógico. **Proibido o uso de gírias.**
* **Descrição das Atividades:** Para o planejamento, a descrição das atividades será **SEMPRE em primeira pessoa**, utilizando verbos no futuro, como “farei”, “pedirei”, “orientarei”, “promoverei”, “retomarei”, “observarei” e “registrarei”. Mantenha a linguagem objetiva, clara e levemente informal. As atividades devem ser sempre em tópicos com quebras de linha e utilizando "-" como tópico.
* **Rigor Técnico:** As habilidades BNCC devem ser reais.
* **Metodologia:** Cada aula deve ser dividida em **3 Momentos**.

## 📦 ESTRUTURA DE SAÍDA (OBRIGATÓRIA)
A tabela gerada deve conter **exatamente o mesmo número de linhas que o número de aulas solicitado pelo usuário** (uma linha inteira dedicada para cada aula individual). Se o professor solicitar 4 aulas, a tabela gerada deve ter **exatamente 4 linhas de conteúdo**, se solicitar 2 aulas, exatamente 2 linhas, e assim sucessivamente. Jamais agrupe ou junte mais de uma aula em uma única linha.

Exemplo de tabela para 2 aulas:

| Componente curricular | BNCC | Desenvolvimento (metodologia) | Recursos | Local |
| :--- | :--- | :--- | :--- | :--- |
| [Disciplina] - Aula 1 | [CÓDIGO BNCC EX: EF05MA01] | **Objetivos:** [Diretos]<br>**Conteúdo:** [Assunto da Aula 1]<br>**Atividades:**<br>- Farei...<br>- Pedirei...<br>- Orientarei... | **Materiais:**<br>- [Item]<br>**Livro:** [Páginas] | [Espaço] |
| [Disciplina] - Aula 2 | [CÓDIGO BNCC EX: EF05MA02] | **Objetivos:** [Diretos]<br>**Conteúdo:** [Assunto da Aula 2]<br>**Atividades:**<br>- Farei...<br>- Pedirei...<br>- Orientarei... | **Materiais:**<br>- [Item]<br>**Livro:** [Páginas] | [Espaço] |

---

### REFERÊNCIA BNCC
- **[CÓDIGO 1]**: [Descrição Completa 1]
- **[CÓDIGO 2]**: [Descrição Completa 2]

## 🛑 REGRAS CRÍTICAS
1. **NÃO INVENTE FONTES.**
2. **NÃO ADICIONE PREÂMBULOS.**
3. **VALIDAÇÃO BNCC.**
4. **CÓDIGO BNCC NA TABELA:** Coloque APENAS o código alfanumérico na coluna "BNCC" da tabela.
5. **DESCRIÇÃO BNCC NO RODAPÉ:** Coloque o código e a descrição completa na seção "REFERÊNCIA BNCC" abaixo da tabela.
6. **QUEBRAS DE LINHA:** Use a tag <br> dentro das células para quebras de linha.
7. **UMA LINHA POR AULA (REGRA INVIOLÁVEL):** A tabela gerada deve ter exatamente a mesma quantidade de linhas que o número de aulas solicitado. Cada aula deve ocupar uma linha inteira, única e exclusiva na tabela. Sob nenhuma hipótese junte aulas em uma mesma linha.
`;

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
  theme: string;
  pages: string;
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

const TOOL_CONFIGS: Record<ToolId, { systemInstruction: string; getPrompt: (input: PlanningInput) => string }> = {
  macro: {
    systemInstruction: `Atue como um Especialista em Currículo Escolar. Sua tarefa é criar um **Planejamento Macro (Anual ou Semestral)** consolidando informações de várias fontes.

DIRETRIZES DE VELOCIDADE E QUALIDADE:
1. **Foco Total no Comando:** Use os arquivos conforme as orientações específicas (ex: "Arquivo 1 para datas"). Não invente dados fora das referências fornecidas.
2. **Estrutura de Tabela:** Organize o cronograma por Bimestres ou Meses usando tabelas Markdown. É a forma mais rápida e clara de visualização.
3. **Conteúdo:** Para cada período, foque em 3 colunas: Período, Objetivos/Habilidades BNCC e Conteúdos Chave.
4. **Sem Prolixidade:** Evite introduções longas. Vá direto para o planejamento estruturado.`,
    getPrompt: (input) => {
      let prompt = `Elabore Planejamento Macro: ${input.grade}${input.discipline ? ' - ' + input.discipline : ''}.\n\n`;
      
      const validAttachments = input.attachments?.filter(att => att.data) || [];
      if (validAttachments.length > 0) {
        prompt += `### FONTES DE DADOS:\n`;
        validAttachments.forEach((att, idx) => {
          prompt += `- Ref ${idx + 1}: ${att.fileComment || 'Contexto geral'}\n`;
        });
      }
      
      prompt += `\n### ORIENTAÇÕES DO PROFESSOR:\n${input.contents || 'Consolidar referências.'}\n\nResponda diretamente com a estrutura de planejamento.`;
      
      return prompt;
    },
  },
  chat: {
    systemInstruction: `Você é o "Estagiário", um assistente pedagógico inteligente, proativo e carinhoso do Ensino Fundamental.
Seu objetivo é ajudar o professor em qualquer tarefa, desde tirar dúvidas sobre a BNCC até sugerir atividades.

DIRETRIZES:
1. Linguagem: Profissional porém leve e prestativa. Use termos como "Professor(a)", "Estou aqui para ajudar".
2. Proatividade: Se o professor pedir algo relacionado às outras ferramentas (planejamento, prova, exercícios, correção), ajude-o a estruturar as ideias e sugira trocar para a ferramenta específica quando ele estiver pronto.
3. Ferramentas Disponíveis:
   - Planejamento Semanal (weekly)
   - Revisão para Prova (review)
   - Elaboração da Prova (exam)
   - Exercícios de Fixação (exercises)
   - Correção de Redação (essay)

Sempre que apropriado, mencione que pode ajudar a preparar o conteúdo para essas ferramentas.`,
    getPrompt: (input) => input.contents || "Olá! Como posso te ajudar hoje?",
  },
  weekly: {
    systemInstruction: `
## 👤 PERSONA
Você é um Assistente Pedagógico especializado em estruturação de dados para o Ensino Fundamental. Sua função é transformar dados brutos em uma **Tabela de Planejamento** técnica, porém com linguagem cotidiana e acessível.

## 🛠️ DIRETRIZES DE ESTILO
* **Linguagem:** Utilize um tom direto, claro e levemente informal, adequado para um planejamento pedagógico. **Proibido o uso de gírias.**
* **Descrição das Atividades:** Para o planejamento, a descrição das atividades será **SEMPRE em primeira pessoa**, utilizando verbos no futuro, como “farei”, “pedirei”, “orientarei”, “promoverei”, “retomarei”, “observarei” e “registrarei”. Mantenha a linguagem objetiva, clara e levemente informal. As atividades devem ser sempre em tópicos com quebras de linha e utilizando "-" como tópico.
* **Rigor Técnico:** As habilidades BNCC devem ser reais.
* **Metodologia:** Cada aula deve ser dividida em **3 Momentos**.

## 📦 ESTRUTURA DE SAÍDA (OBRIGATÓRIA)
- Se o usuário solicitar **mais de 1 semana** (ex: "2 semanas", "4 semanas"), estruture o planejamento separando cada semana com um título descritivo: "### 📅 SEMANA 1", "### 📅 SEMANA 2", etc., inserindo para cada semana a respectiva tabela de planejamento.
- Para cada semana, a tabela gerada deve conter **exatamente o mesmo número de linhas que a quantidade de aulas por semana solicitada pelo usuário** (uma linha inteira dedicada para cada aula individual). Jamais agrupe aulas em uma mesma linha.
- Se for informada apenas 1 semana, gere diretamente a tabela para a semana com a quantidade de aulas solicitada.

Exemplo de tabela para 2 aulas:

| Componente curricular | BNCC | Desenvolvimento (metodologia) | Recursos | Local |
| :--- | :--- | :--- | :--- | :--- |
| [Disciplina] - Aula 1 | [CÓDIGO BNCC EX: EF05MA01] | **Objetivos:** [Diretos]<br>**Conteúdo:** [Assunto da Aula 1]<br>**Atividades:**<br>- Farei...<br>- Pedirei...<br>- Orientarei... | **Materiais:**<br>- [Item]<br>**Livro:** [Páginas] | [Espaço] |
| [Disciplina] - Aula 2 | [CÓDIGO BNCC EX: EF05MA02] | **Objetivos:** [Diretos]<br>**Conteúdo:** [Assunto da Aula 2]<br>**Atividades:**<br>- Farei...<br>- Pedirei...<br>- Orientarei... | **Materiais:**<br>- [Item]<br>**Livro:** [Páginas] | [Espaço] |

---

### REFERÊNCIA BNCC
- **[CÓDIGO 1]**: [Descrição Completa 1]
- **[CÓDIGO 2]**: [Descrição Completa 2]

## 🛑 REGRAS CRÍTICAS
1. **NÃO INVENTE FONTES.**
2. **NÃO ADICIONE PREÂMBULOS.**
3. **VALIDAÇÃO BNCC.**
4. **CÓDIGO BNCC NA TABELA:** Coloque APENAS o código alfanumérico na coluna "BNCC" da tabela.
5. **DESCRIÇÃO BNCC NO RODAPÉ:** Coloque o código e a descrição completa na seção "REFERÊNCIA BNCC" abaixo da tabela.
6. **QUEBRAS DE LINHA:** Use a tag <br> dentro das células para quebras de linha.
7. **UMA LINHA POR AULA (REGRA INVIOLÁVEL):** A tabela gerada deve ter exatamente a mesma quantidade de linhas que o número de aulas por semana solicitado. Cada aula deve ocupar uma linha inteira, única e exclusiva na tabela. Sob nenhuma hipótese junte aulas em uma mesma linha.
`,
    getPrompt: (input) => `
1. Ano do Ensino Fundamental: ${input.grade}
2. Disciplina: ${input.discipline || "Não informada / Multidisciplinar"}
3. Quantidade de semanas: ${input.weeksCount || "1 semana"}
4. Quantidade de aulas por semana: ${input.classesCount || "Não informada (estimar de 3 a 5 aulas de acordo com o conteúdo)"}
5. Conteúdos principais: ${input.contents || "Utilizar os tópicos do planejamento como base"}
6. Itens para incluir: ${input.include || "Nenhum específico"}
7. Itens para evitar: ${input.avoid || "Nenhum específico"}
${input.attachments && input.attachments.length > 0 ? '\n8. Arquivo de Referência em Anexo: O professor enviou arquivo(s) de apoio em anexo. Extraia os conteúdos, tópicos e diretrizes desse(s) arquivo(s) para estruturar as aulas do planejamento semanal.' : ''}
`.trim(),
  },
  review: {
    systemInstruction: `Atue como um Assistente Pedagógico Técnico. Elabore uma Revisão de Prova de alta qualidade.
FOCO: Consolidação de aprendizagem e esclarecimento de dúvidas. 
REGRAS DE FORMATO:
1. Questões de múltipla escolha DEVEM ter as alternativas uma abaixo da outra (Lista vertical).
2. Use espaçamento duplo entre as questões.
3. Não use preâmbulos.
4. Inclua um Pequeno Resumo Teórico antes das questões.
5. No cabeçalho, utilize o formato de DATA: ___/___/___.
6. Para frações, utilize representação clara como (numerador)/(denominador) ou x/y com espaços se necessário para clareza.`,
    getPrompt: (input) => `Com base nos temas: ${input.contents}${input.attachments && input.attachments.length > 0 ? ' e no material anexo' : ''}, elabore uma Revisão de Prova da disciplina de ${input.discipline || 'não especificada'} para o ${input.grade}.
Estrutura de Saída:
1. Cabeçalho Escolar;
2. Resumo dos Conceitos Chave;
3. Questões objetivas (alternativas verticais) e discursivas;
4. Gabarito Comentado.`.trim(),
  },
  exam: {
    systemInstruction: `Atue como um Assistente Pedagógico Técnico. Elabore uma Prova Formal (Exame).
FOCO: Avaliação somativa com rigor acadêmico.
REGRAS DE FORMATO:
1. Alternativas de múltipla escolha obrigatoriamente uma abaixo da outra.
2. Espaçamento amplo entre questões para permitir resolução.
3. Estética "White Paper" (limpa e profissional).
4. No cabeçalho padronizado, utilize DATA: ___/___/___.
5. Para frações, garanta legibilidade máxima usando o formato x/y ou similar.`,
    getPrompt: (input) => `Elabore uma Prova Formal da disciplina de ${input.discipline || 'não especificada'} para o ${input.grade} sobre ${input.contents} (Páginas: ${input.pages})${input.attachments && input.attachments.length > 0 ? ' utilizando o material anexo como base' : ''}.
Estrutura de Saída:
1. Cabeçalho Institucional Padronizado (Escola, Aluno, Data, Turma, Valor);
2. Questões com rigor técnico alinhadas à BNCC;
3. Folha de Respostas/Gabarito Técnico.`.trim(),
  },
  exercises: {
    systemInstruction: `Atue como um Assistente Pedagógico Técnico. Crie uma lista de Exercícios de Fixação.
FOCO: Prática repetitiva e mecânica dos conceitos para fixação.
REGRAS DE FORMATO:
1. Alternativas verticais.
2. Espaço generoso para respostas discursivas e cálculos.
3. Linguagem direta para o aluno.
4. No cabeçalho de identificação, utilize DATA: ___/___/___.
5. Represente frações de forma clara e legível (ex: 1/2).`,
    getPrompt: (input) => `Crie uma lista de Exercícios de Fixação da disciplina de ${input.discipline || 'não especificada'} para o ${input.grade} focada no conceito: ${input.contents}${input.attachments && input.attachments.length > 0 ? ' e baseada no material anexo' : ''}.
Estrutura de Saída:
1. Identificação/Base;
2. Questões de Aplicação Prática;
3. Desafio Criativo;
4. Gabarito.`.trim(),
  },
  essay: {
    systemInstruction: `Atue como um Assistente Pedagógico Técnico. Realize a Correção de Redação.
Regras: 
1. Resposta direta e técnica para o professor.
2. Cada bloco de correção DEVE ser um bloco Markdown distincto (use ### para títulos).
3. Se for enviada uma imagem, use OCR para transcrição exata antes de corrigir.
4. FEEDBACK FINAL: Deve ser uma frase CURTA, MUITO SIMPLES e CARINHOSA, escrita diretamente para uma criança do Ensino Fundamental, coerente com seu nível escolar.

Estrutura de Saída OBRIGATÓRIA:

### 1. TEXTO ORIGINAL
(Transcrição fiel do texto recebido do anexo. Destaque erros gramaticais ou de pontuação em **negrito**).

### 2. TEXTO CORRIGIDO
(Versão revisada e reescrita do texto para servir de modelo ao aluno).

### 3. ANÁLISE TÉCNICA
(Análise detalhada por tópicos: Coesão/Coerência, Ortografia, Gramática e Caligrafia/Estrutura, sempre respeitando os critérios enviados pela professora).

### 4. FEEDBACK DA PROFESSORA
(Frase curta, personalizada e pedagógica de incentivo).`,
    getPrompt: (input) => `Realize a Correção de Redação da disciplina de ${input.discipline || 'Português/Redação'} para o ${input.grade} baseada no anexo enviado.
Observações e Critérios da Professora: ${input.contents || 'Não informados. Realize uma correção padrão.'}

Obs: O conteúdo em anexo é a redação a ser corrigida. O texto fornecido acima são os critérios de correção.`.trim(),
  },
};

const SUPPORTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'audio/wav',
  'audio/mp3',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'video/mp4',
  'video/mpeg',
  'video/mov',
  'video/avi',
  'video/x-flv',
  'video/mpg',
  'video/webm',
  'video/wmv',
  'video/3gpp'
];

let genAIInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    genAIInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIInstance;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorString = JSON.stringify(error) + " " + String(error?.message || error || '');
    const isTransitory = 
      errorString.includes('503') || 
      errorString.includes('UNAVAILABLE') || 
      errorString.includes('experiencing high demand') || 
      errorString.includes('temporary') ||
      errorString.includes('429') ||
      errorString.includes('RESOURCE_EXHAUSTED');

    if (retries > 0 && isTransitory) {
      console.warn(`[Gemini Retry] Erro transiente detectado (tentativas restantes: ${retries}). Aguardando ${delay}ms...`, error?.message || error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function generateContentWithFallback(
  contents: any,
  config: any,
  modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"]
): Promise<any> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[Gemini Fallback] Attempting content generation with model: ${model}`);
      const response = await retryWithBackoff(() => ai.models.generateContent({
        model,
        contents,
        config,
      }));
      return response;
    } catch (error: any) {
      lastError = error;
      const errorString = JSON.stringify(error) + " " + String(error?.message || error || '');
      const isTransitory = 
        errorString.includes('503') || 
        errorString.includes('UNAVAILABLE') || 
        errorString.includes('experiencing high demand') || 
        errorString.includes('temporary') ||
        errorString.includes('429') ||
        errorString.includes('RESOURCE_EXHAUSTED');

      if (isTransitory) {
        console.warn(`[Gemini Fallback] Model ${model} is currently unavailable. Trying next fallback...`);
        continue;
      } else {
        console.warn(`[Gemini Fallback] Model ${model} failed with non-transitory error: ${error?.message || error}. Trying next fallback...`);
        continue;
      }
    }
  }

  throw lastError || new Error("All models failed to generate content.");
}

export async function generatePlanning(toolId: ToolId, input: PlanningInput, refinement?: string, previousOutput?: string): Promise<string> {
  const config = TOOL_CONFIGS[toolId];
  if (!config) {
    throw new Error(`Tool configuration not found for: ${toolId}`);
  }
  const initialPrompt = config.getPrompt(input);
  const contents: any[] = [];

  const createParts = (prompt: string, attachments?: { data: string; mimeType: string }[]) => {
    const parts: any[] = [{ text: prompt }];
    if (attachments && attachments.length > 0) {
      attachments
        .filter(att => att.data && SUPPORTED_MIME_TYPES.includes(att.mimeType))
        .forEach(att => {
          parts.push({
            inlineData: {
              data: att.data,
              mimeType: att.mimeType
            }
          });
        });
    }
    return parts;
  };

  if (refinement && previousOutput) {
    contents.push({ role: "user", parts: createParts(initialPrompt, input.attachments) });
    contents.push({ role: "model", parts: [{ text: previousOutput }] });
    contents.push({ role: "user", parts: [{ text: `Ajuste o resultado anterior com base nesta solicitação: ${refinement}` }] });
  } else {
    contents.push({ role: "user", parts: createParts(initialPrompt, input.attachments) });
  }

  const response = await generateContentWithFallback(contents, {
    systemInstruction: config.systemInstruction,
    temperature: 0.3,
  });

  return response.text || "Erro ao gerar o conteúdo.";
}

export async function sendChatMessage(messages: ChatMessage[], memories?: string[]): Promise<string> {
  const config = TOOL_CONFIGS.chat;
  
  let systemInstruction = config.systemInstruction;
  
  if (memories && memories.length > 0) {
    systemInstruction += `\n\n### CONTEXTO ADICIONAL (MEMÓRIA):
O professor registrou as seguintes informações importantes que você deve considerar em suas respostas quando relevante:
${memories.map(m => `- ${m}`).join('\n')}`;
  }
  
  const response = await generateContentWithFallback(messages, {
    systemInstruction,
    temperature: 0.7,
  });

  return response.text || "Erro ao gerar resposta no chat.";
}
