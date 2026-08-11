/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, Calendar, PencilLine, ClipboardList, Layout, Send, Sparkles, Loader2, 
  RefreshCw, Zap, GraduationCap, FileSearch, FileText, PenTool, Rocket, Undo2, 
  Copy, Check, Upload, Image as ImageIcon, X, Trash2, ChevronLeft, ChevronRight,
  Menu, User, Plus, Search, MessageSquare, Clock, FileDown, MoreHorizontal,
  FileSpreadsheet, Download, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { generatePlanning, sendChatMessage, PlanningInput, ToolId, ChatMessage } from './services/gemini';

// Interface for visual tools matching the purple design in the mockup
interface VisualTool {
  id: ToolId;
  title: string;
  desc: string;
  category: 'planning' | 'evaluations' | 'essay' | 'chat';
  icon: any;
  gradient: string;
  badge: string;
  bgColor: string;
  textColor: string;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'Todos' | 'planning' | 'evaluations' | 'essay' | 'chat'>('Todos');
  const [histories, setHistories] = useState<Record<ToolId, string[]>>({
    macro: [], weekly: [], review: [], exam: [], exercises: [], essay: [], chat: []
  });
  const [currentIndices, setCurrentIndices] = useState<Record<ToolId, number>>({
    macro: -1, weekly: -1, review: -1, exam: -1, exercises: -1, essay: -1, chat: -1
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMemories, setChatMemories] = useState<string[]>([]);
  const [chatViewMode, setChatViewMode] = useState<'chat' | 'memory'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [chatFiles, setChatFiles] = useState<{ data: string; mimeType: string; name: string }[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [refinement, setRefinement] = useState('');
  const [currentStep, setCurrentStep] = useState<'intro' | 'planning'>('intro');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [sheetsExportSuccess, setSheetsExportSuccess] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ToolId | null>(null);

  // Visual definition of the 8 sub-tools following the beautiful design from the reference image
  const visualTools: VisualTool[] = [
    { 
      id: 'weekly', 
      title: 'Planejamento Semanal', 
      desc: 'Cronograma detalhado e aulas alinhadas às diretrizes da BNCC.', 
      category: 'planning', 
      icon: Calendar, 
      gradient: 'from-[#5D38FD] to-[#8063FD]', 
      badge: 'Planejamentos',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600'
    },
    { 
      id: 'macro', 
      title: 'Planejamento Macro', 
      desc: 'Visão anualizada da grade, metas pedagógicas e diretrizes.', 
      category: 'planning', 
      icon: Layout, 
      gradient: 'from-[#8b5cf6] to-[#a78bfa]', 
      badge: 'Planejamentos',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    { 
      id: 'exercises', 
      title: 'Exercícios de Fixação', 
      desc: 'Geração de questionários direcionados com foco em fixação.', 
      category: 'evaluations', 
      icon: ClipboardList, 
      gradient: 'from-[#ec4899] to-[#f472b6]', 
      badge: 'Provas & Exercícios',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600'
    },
    { 
      id: 'review', 
      title: 'Revisão de Prova', 
      desc: 'Fichas, resumos de conteúdos e atividades para pré-avaliação.', 
      category: 'evaluations', 
      icon: FileSearch, 
      gradient: 'from-[#f59e0b] to-[#fbbf24]', 
      badge: 'Provas & Exercícios',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    },
    { 
      id: 'exam', 
      title: 'Elaboração de Prova', 
      desc: 'Avaliador completo com cabeçalho, questões e gabaritos comentados.', 
      category: 'evaluations', 
      icon: FileText, 
      gradient: 'from-[#06b6d4] to-[#22d3ee]', 
      badge: 'Provas & Exercícios',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-600'
    },
    { 
      id: 'essay', 
      title: 'Correção de Redação', 
      desc: 'Análise criteriosa, cálculo de nota BNCC e reescrita sugerida.', 
      category: 'essay', 
      icon: PenTool, 
      gradient: 'from-[#10b981] to-[#34d399]', 
      badge: 'Redação',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    },
    { 
      id: 'chat', 
      title: 'Chat Estagiário', 
      desc: 'Tire dúvidas rápidas, elabore dinâmicas e peça ideias de aulas.', 
      category: 'chat', 
      icon: Sparkles, 
      gradient: 'from-[#14b8a6] to-[#2dd4bf]', 
      badge: 'Conversa IA',
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-600'
    }
  ];

  const currentAction = visualTools.find(a => a.id === selectedAction);
  const history = selectedAction ? histories[selectedAction] || [] : [];
  const currentIndex = selectedAction ? currentIndices[selectedAction] ?? -1 : -1;
  const output = currentIndex >= 0 ? history[currentIndex] : null;

  const [form, setForm] = useState<PlanningInput>({
    grade: '',
    discipline: '',
    theme: '',
    pages: '',
    classesCount: '',
    contents: '',
    include: '',
    avoid: '',
    weeksCount: '',
    concept: '',
  });

  // Carregar estado salvo ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('estagiario_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.histories) setHistories(parsed.histories);
        if (parsed.currentIndices) setCurrentIndices(parsed.currentIndices);
        if (parsed.chatMessages) setChatMessages(parsed.chatMessages);
        if (parsed.chatMemories) setChatMemories(parsed.chatMemories);
        if (parsed.form) setForm(parsed.form);
        if (parsed.selectedAction) {
          setSelectedAction(parsed.selectedAction);
          if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        } else {
          setCurrentStep('intro');
        }
      } catch (e) {
        console.error('Erro ao carregar estado salvo:', e);
      }
    }
  }, []);

  // Salvar estado sempre que houver mudanças relevantes
  useEffect(() => {
    const state = {
      histories,
      currentIndices,
      chatMessages,
      chatMemories,
      form,
      selectedAction,
      currentStep
    };
    localStorage.setItem('estagiario_state', JSON.stringify(state));
  }, [histories, currentIndices, chatMessages, chatMemories, form, selectedAction, currentStep]);

  const getFriendlyErrorMessage = (err: any): string => {
    const msg = err?.message || String(err || '');
    if (msg.includes('API Key') || msg.includes('GEMINI_API_KEY') || msg.includes('API_KEY')) {
      return 'Chave de API do Gemini não configurada ou inválida. Por favor, adicione seu GEMINI_API_KEY na seção Secrets em Configurações.';
    }
    if (msg.includes('depleted') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('credits')) {
      return 'Créditos do modelo esgotados ou limite de requisições excedido. Por favor, verifique o faturamento e créditos de sua chave de API do Gemini no console do Google AI Studio.';
    }
    if (msg.includes('503') || msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('temporarily') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('spikes in demand')) {
      return 'O modelo de Inteligência Artificial está sob alta demanda temporária ou indisponível no momento (Erro 503 / UNAVAILABLE). Por favor, aguarde alguns segundos e tente novamente.';
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
      return 'Erro de conexão ou servidor offline. Por favor, verifique sua conexão com a internet.';
    }
    return msg || 'Houve um erro ao processar sua solicitação. Tente novamente em instantes.';
  };

  const fillSampleData = () => {
    if (!selectedAction) return;
    const samples: Record<ToolId, any[]> = {
      macro: [
        { grade: '6º Ano', discipline: 'História', contents: 'Cronograma Anual focado em História Antiga e Idade Média. Integrar as datas do calendário escolar anexo.' },
        { grade: '8º Ano', discipline: 'Ciências', contents: 'Planejamento anual focado em Anatomia Humana e Ecologia. Considerar feira de ciências em Outubro.' },
        { grade: '3º Ano', discipline: 'Geografia', contents: 'Ciclo anual de cartografia e biomas brasileiros. Enfoque em educação ambiental.' }
      ],
      weekly: [
        { grade: '3º Ano', discipline: 'História', weeksCount: '1 semana', classesCount: '2 aulas', contents: 'Espaços Públicos e Privados; identificação na cidade e regras de convivência.', include: 'Atividade prática de observação.', avoid: 'Termos técnicos complexos.' },
        { grade: '5º Ano', discipline: 'Ciências', weeksCount: '2 semanas', classesCount: '3 aulas', contents: 'Sistema Circulatório: função do coração, vasos sanguíneos e pulsação.', include: 'Medir a pulsação.', avoid: 'Patologias cardíacas.' },
        { grade: '4º Ano', discipline: 'Geografia', weeksCount: '3 semanas', classesCount: '2 aulas', contents: 'O Relevo Brasileiro: principais formas como planaltos, planícies e depressões.', include: 'Uso de mapas físicos.', avoid: 'Geologia avançada.' },
        { grade: '2º Ano', discipline: 'Matemática', weeksCount: '1 semana', classesCount: '4 aulas', contents: 'Figuras Geométricas: círculo, quadrado, triângulo e retângulo no dia a dia.', include: 'Recortes de revistas.', avoid: 'Cálculo de áreas.' },
        { grade: '1º Ano', discipline: 'Artes', weeksCount: '1 semana', classesCount: '1 aula', contents: 'As Cores Primárias: identificação e mistura de azul, vermelho e amarelo.', include: 'Pintura a dedo.', avoid: 'Teoria da cor complexa.' },
        { grade: '9º Ano', discipline: 'Física', weeksCount: '2 semanas', classesCount: '2 aulas', contents: 'Movimento Uniforme: velocidade média, distância e tempo.', include: 'Cronômetro de celular.', avoid: 'Física quântica.' },
      ],
      review: [
        { grade: '7º Ano', contents: 'Grandes Navegações, Renascimento Cultural e Reforma Protestante.', discipline: 'História' },
        { grade: '9º Ano', contents: 'Equações de 2º grau, Teorema de Pitágoras e Semelhança de Triângulos.', discipline: 'Matemática' },
        { grade: '6º Ano', contents: 'Tipos de Rochas, Camadas da Terra e Tectônica de Placas.', discipline: 'Geografia' },
        { grade: '8º Ano', contents: 'Células Animais e Vegetais, Organelas e suas Funções.', discipline: 'Ciências' },
        { grade: '3º Ano', contents: 'Adição e Subtração com reserva, interpretação de problemas.', discipline: 'Matemática' },
      ],
      exam: [
        { grade: '6º Ano', contents: 'Ecossistemas, Cadeia Alimentar e Fotossíntese', discipline: 'Ciências' },
        { grade: '8º Ano', contents: 'Revolução Industrial e Iluminismo', discipline: 'História' },
        { grade: '9º Ano', contents: 'Probabilidade, Estatística e Análise de Gráficos', discipline: 'Matemática' },
        { grade: '7º Ano', contents: 'Verb To Be, Simple Present e Vocabulary: Family', discipline: 'Inglês' },
        { grade: '5º Ano', contents: 'Era Vargas, Populismo e Urbanização no Brasil', discipline: 'História' },
      ],
      exercises: [
        { grade: '4º Ano', contents: 'Frações equivalentes e comparação de frações.', discipline: 'Matemática' },
        { grade: '2º Ano', contents: 'Uso de R e RR nas palavras.', discipline: 'Português' },
        { grade: '5º Ano', contents: 'Grécia Antiga: Mitologia e Democracia.', discipline: 'História' },
        { grade: '3º Ano', contents: 'Estados físicos da água e ciclo da água.', discipline: 'Ciências' },
        { grade: '1º Ano', contents: 'Alfabetização: sílabas complexas LH e NH.', discipline: 'Português' },
      ],
      essay: [
        { grade: '9º Ano', contents: 'O uzo do celularno cotidiano fas com que agente fique deprimente pq a midia so mostra gente feliz e rica. Isso e ruim pros jovem.', discipline: 'Português' },
        { grade: '5º Ano', contents: 'A importance da agua e mto grande pq sem ela nois morre. Presisamos economizar e nao joga lixo nos rio.', discipline: 'Ciências' },
        { grade: '8º Ano', contents: 'O buling na escola e uma coisa mto seria. Os aluno sofre mto e os professor tem que ajuda a para com isso pq tira o focar dps estudo.', discipline: 'Português' },
        { grade: '7º Ano', contents: 'O desmatamento da amazonia ta matando os bixo tudo. Agente precisa para de corta as arvore se nao o oxigenio vai acaba.', discipline: 'Geografia' },
      ],
      chat: [
        { contents: 'Como posso organizar um projeto sobre meio ambiente para o 3º ano?' },
        { contents: 'Quais habilidades BNCC tratam de frações no 5º ano?' },
        { contents: 'Me dê dicas de como lidar com indisciplina em sala de aula.' },
        { contents: 'Sugestões de dinâmicas para o primeiro dia de aula.' },
      ],
    };
    
    const toolSamples = samples[selectedAction] || [];
    const currentValues = selectedAction === 'chat' ? chatInput : JSON.stringify(form);
    let randomSample = toolSamples[Math.floor(Math.random() * toolSamples.length)];
    
    if (toolSamples.length > 1) {
      const sampleString = selectedAction === 'chat' ? randomSample.contents : JSON.stringify({ ...form, ...randomSample });
      if (sampleString === currentValues) {
        randomSample = toolSamples[Math.floor(Math.random() * toolSamples.length)];
      }
    }
    
    if (selectedAction === 'chat') {
      setChatInput(randomSample.contents || '');
    } else {
      setForm({
        grade: '', discipline: '', theme: '', pages: '', classesCount: '', contents: '', include: '', avoid: '', weeksCount: '', concept: '',
        ...(randomSample || {})
      });
    }
  };

  const clearForm = () => {
    if (!selectedAction) return;
    if (selectedAction === 'chat') {
      setChatInput('');
      setChatFiles([]);
    } else {
      setForm({
        grade: '',
        discipline: '',
        theme: '',
        pages: '',
        classesCount: '',
        contents: '',
        include: '',
        avoid: '',
        weeksCount: '',
        concept: '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generatePlanning(selectedAction, form);
      setHistories(prev => ({ ...prev, [selectedAction]: [result] }));
      setCurrentIndices(prev => ({ ...prev, [selectedAction]: 0 }));
      setRefinement('');
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!selectedAction || !refinement.trim() || !output) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generatePlanning(selectedAction, form, refinement, output);
      const newHistory = [...history, result];
      setHistories(prev => ({ ...prev, [selectedAction]: newHistory }));
      setCurrentIndices(prev => ({ ...prev, [selectedAction]: newHistory.length - 1 }));
      setRefinement('');
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (!selectedAction || currentIndex <= 0) return;
    setCurrentIndices(prev => ({ ...prev, [selectedAction]: (prev[selectedAction] || 0) - 1 }));
  };

  const handleRedo = () => {
    if (!selectedAction || currentIndex >= history.length - 1) return;
    setCurrentIndices(prev => ({ ...prev, [selectedAction]: (prev[selectedAction] || 0) + 1 }));
  };

  const restoreVersion = (index: number) => {
    if (!selectedAction) return;
    setCurrentIndices(prev => ({ ...prev, [selectedAction]: index }));
  };

  const resetResult = async () => {
    if (!selectedAction || loading || !output) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generatePlanning(selectedAction, form);
      const newHistory = [...history, result];
      setHistories(prev => ({ ...prev, [selectedAction]: newHistory }));
      setCurrentIndices(prev => ({ ...prev, [selectedAction]: newHistory.length - 1 }));
      setRefinement('');
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const formatContentForSheets = (rawMarkdown: string) => {
    if (!rawMarkdown) {
      return { mainTableRows: [], bnccRows: [], tsvContent: '', csvContent: '', htmlContent: '', mainTableHtml: '' };
    }

    const cleanText = rawMarkdown
      .replace(/^```(markdown|text)?\n/gi, '')
      .replace(/\n```$/g, '')
      .trim();

    const lines = cleanText.split('\n');
    const mainTableRows: string[][] = [];
    const bnccRows: string[][] = [];

    let inBnccSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes('REFERÊNCIA BNCC') || line.includes('REFERENCIAS BNCC')) {
        inBnccSection = true;
        continue;
      }

      // Skip markdown table delimiter rows like | :--- | :--- | or |---|---|
      if (/^\s*\|?\s*(:\s*-+|-+|-+:\s*|:\s*-+:\s*)(\s*\|\s*(:\s*-+|-+|-+:\s*|:\s*-+:\s*))*\s*\|?\s*$/.test(line)) {
        continue;
      }

      // Check if line is a table row (has pipe symbols)
      if (line.includes('|')) {
        let parts = line.split('|');
        if (parts.length > 0 && parts[0].trim() === '') parts.shift();
        if (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop();

        if (parts.length > 0) {
          const rowCells = parts.map(cell => {
            let content = cell.trim();
            // Replace <br> variants with real newlines
            content = content.replace(/<br\s*\/?>/gi, '\n');
            // Remove remaining HTML tags
            content = content.replace(/<\/?[^>]+(>|$)/g, '');
            // Convert bold/italic markdown
            content = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
            return content;
          });

          if (rowCells.some(c => c.length > 0)) {
            mainTableRows.push(rowCells);
          }
          continue;
        }
      }

      // If in BNCC section and line is list item like "- **EF03HI01**: Descrição..."
      if (inBnccSection && (line.startsWith('- ') || line.startsWith('* '))) {
        let cleanLine = line.substring(2).trim()
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1');

        if (cleanLine.includes(': ')) {
          const colonIdx = cleanLine.indexOf(': ');
          const code = cleanLine.substring(0, colonIdx).trim();
          const desc = cleanLine.substring(colonIdx + 2).trim();
          bnccRows.push([code, desc]);
        } else if (cleanLine) {
          bnccRows.push([cleanLine]);
        }
      }
    }

    const escapeHtml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const buildHtmlTable = (rows: string[][], isHeaderFirst = true) => {
      if (rows.length === 0) return '';
      let html = '<table border="1" cellSpacing="0" cellPadding="8" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt;">\n';
      
      rows.forEach((row, rIdx) => {
        const isHeader = isHeaderFirst && rIdx === 0;
        html += '  <tr>\n';
        row.forEach(cell => {
          const formatted = escapeHtml(cell).replace(/\n/g, '<br>');
          if (isHeader) {
            html += `    <th style="background-color: #1e293b; color: #ffffff; padding: 10px; font-weight: bold; border: 1px solid #475569; text-align: left; vertical-align: top;">${formatted}</th>\n`;
          } else {
            html += `    <td style="padding: 8px; border: 1px solid #cbd5e1; vertical-align: top; white-space: pre-wrap; word-break: break-word;">${formatted}</td>\n`;
          }
        });
        html += '  </tr>\n';
      });

      html += '</table>';
      return html;
    };

    const mainTableHtml = buildHtmlTable(mainTableRows, true);

    let fullHtml = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n<!--StartFragment-->\n`;
    fullHtml += mainTableHtml;

    if (bnccRows.length > 0) {
      fullHtml += '\n<br><br>\n';
      fullHtml += '<table border="1" cellSpacing="0" cellPadding="6" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt;">\n';
      fullHtml += '  <tr><th colspan="2" style="background-color: #f1f5f9; color: #0f172a; padding: 8px; font-weight: bold; border: 1px solid #cbd5e1; text-align: left;">REFERÊNCIA BNCC</th></tr>\n';
      bnccRows.forEach(row => {
        fullHtml += '  <tr>\n';
        if (row.length >= 2) {
          fullHtml += `    <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; vertical-align: top; width: 120px;">${escapeHtml(row[0])}</td>\n`;
          fullHtml += `    <td style="padding: 6px; border: 1px solid #cbd5e1; vertical-align: top;">${escapeHtml(row[1])}</td>\n`;
        } else {
          fullHtml += `    <td colspan="2" style="padding: 6px; border: 1px solid #cbd5e1; vertical-align: top;">${escapeHtml(row[0])}</td>\n`;
        }
        fullHtml += '  </tr>\n';
      });
      fullHtml += '</table>\n';
    }

    fullHtml += `\n<!--EndFragment-->\n</body>\n</html>`;

    // TSV content: replace internal newlines with <br> so plain-text paste never shatters cells into multiple rows
    const tsvContent = mainTableRows.map(row => {
      return row.map(cell => {
        let text = cell.replace(/\r/g, '').replace(/\n/g, '<br>');
        if (text.includes('\t') || text.includes('"')) {
          text = `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      }).join('\t');
    }).join('\n');

    // CSV for file download
    const allCsvRows = [...mainTableRows];
    if (bnccRows.length > 0) {
      allCsvRows.push([]);
      allCsvRows.push(['REFERÊNCIA BNCC']);
      bnccRows.forEach(r => allCsvRows.push(r));
    }

    const csvContent = '\uFEFF' + allCsvRows.map(row => {
      return row.map(cell => {
        let text = cell.replace(/\r/g, '');
        if (text.includes(';') || text.includes('\n') || text.includes('"') || text.includes(',')) {
          text = `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      }).join(';');
    }).join('\r\n');

    return { mainTableRows, bnccRows, tsvContent, csvContent, htmlContent: fullHtml, mainTableHtml };
  };

  const handleCopyForSheets = async (onlyMainTable = false) => {
    if (!output) return;
    const { tsvContent, htmlContent, mainTableHtml } = formatContentForSheets(output);

    const selectedHtml = onlyMainTable 
      ? `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n<!--StartFragment-->\n${mainTableHtml}\n<!--EndFragment-->\n</body>\n</html>`
      : htmlContent;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([selectedHtml], { type: 'text/html' });
        const textBlob = new Blob([tsvContent || output], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          })
        ]);
      } else {
        await navigator.clipboard.writeText(tsvContent || output);
      }
      setSheetsExportSuccess(onlyMainTable ? 'Tabela principal copiada!' : 'Tabela formatada copiada para o Google Sheets!');
      setTimeout(() => setSheetsExportSuccess(null), 3500);
    } catch (err) {
      console.error('Falha ao copiar HTML para o Clipboard:', err);
      try {
        await navigator.clipboard.writeText(tsvContent || output);
        setSheetsExportSuccess('Tabela copiada no formato TSV!');
        setTimeout(() => setSheetsExportSuccess(null), 3500);
      } catch (fallbackErr) {
        setError('Não foi possível acessar a área de transferência.');
      }
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await handleCopyForSheets(true);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadCSV = () => {
    if (!output) return;
    const { csvContent } = formatContentForSheets(output);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `planejamento_${form.discipline || 'pedagogico'}_googlesheets.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSheetsExportSuccess('Arquivo .CSV baixado com sucesso!');
    setTimeout(() => setSheetsExportSuccess(null), 3500);
  };

  const handleExportCSV = handleDownloadCSV;

  const handleChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
          setError(`${file.name} deve ter no máximo 5MB`);
          return;
        }

        const isSupported = file.type.startsWith('image/') || 
          ['application/pdf', 'text/plain', 'text/csv', 'text/markdown'].includes(file.type) ||
          /\.(pdf|png|jpe?g|webp|txt|csv|md)$/i.test(file.name);

        if (!isSupported) {
          setError(`O arquivo ${file.name} possui um formato não suportado. Use PDF, Imagens ou Texto.`);
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result?.toString().split(',')[1];
          if (base64) {
            setChatFiles(prev => [...prev.filter(f => f.name !== file.name), { data: base64, mimeType: file.type, name: file.name }]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e && 'key' in e && (e as any).key === 'Enter' && !(e as any).shiftKey) {
      e.preventDefault();
      handleSendChat();
      return;
    }
    if (e?.type === 'submit') e.preventDefault();
    if ((!chatInput.trim() && chatFiles.length === 0) || loading) return;

    const parts: any[] = [];
    if (chatInput.trim()) parts.push({ text: chatInput });
    if (chatFiles.length > 0) {
      chatFiles.forEach(f => {
        parts.push({ inlineData: { data: f.data, mimeType: f.mimeType } });
      });
    }

    const newMessage: ChatMessage = { role: 'user', parts };
    const newChatHistory = [...chatMessages, newMessage];
    
    setChatMessages(newChatHistory);
    setChatInput('');
    setChatFiles([]);
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(newChatHistory, chatMemories);
      setChatMessages([...newChatHistory, { role: 'model', parts: [{ text: response }] }]);
    } catch (err: any) {
      console.error(err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    setChatFiles([]);
    setChatInput('');
  };

  const addMemory = (text: string) => {
    if (!text.trim()) return;
    setChatMemories(prev => [...prev, text]);
  };

  const removeMemory = (index: number) => {
    setChatMemories(prev => prev.filter((_, i) => i !== index));
  };

  // Extract dynamically generated history items to show in the "Histórico Recente" dashboard block (styled like "Progress" in the mockup)
  const recentHistoryItems = Object.entries(histories).flatMap(([toolId, list]) => {
    return list.map((content, idx) => ({
      toolId: toolId as ToolId,
      content,
      index: idx,
      toolInfo: visualTools.find(t => t.id === toolId)
    }));
  }).filter(item => item.content).reverse(); // Latest first

  const deleteHistoryItem = (toolId: ToolId, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja excluir esta versão do histórico?')) {
      setHistories(prev => {
        const list = [...(prev[toolId] || [])];
        list.splice(index, 1);
        return { ...prev, [toolId]: list };
      });
      setCurrentIndices(prev => {
        const cur = prev[toolId] ?? -1;
        let nextCur = cur;
        if (cur >= index) {
          nextCur = Math.max(-1, cur - 1);
        }
        return { ...prev, [toolId]: nextCur };
      });
    }
  };

  // Filter tools based on selected filter pill
  const filteredTools = visualTools.filter(t => {
    if (selectedFilter === 'Todos') return true;
    return t.category === selectedFilter;
  });

  const filterTabs = [
    { id: 'Todos', label: 'Todos' },
    { id: 'planning', label: 'Planejamentos' },
    { id: 'evaluations', label: 'Provas & Exercícios' },
    { id: 'essay', label: 'Redação' },
    { id: 'chat', label: 'Conversa IA' }
  ] as const;

  if (currentStep === 'intro') {
    return (
      <div className="min-h-screen bg-[#EEF2FC] font-sans pb-16 relative overflow-x-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#dae3f8_1.2px,transparent_1.2px)] [background-size:24px_24px] pointer-events-none opacity-60" />
        
        <main className="relative max-w-5xl mx-auto px-4 pt-8 sm:px-6">
          {/* Mockup-style header layout */}
          <header className="mb-8 flex justify-between items-center bg-white px-6 py-4 rounded-[2rem] border border-[#e2eafc] shadow-sm shadow-[#dae3f8]/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-[#5D38FD] to-[#8063FD] rounded-xl flex items-center justify-center text-white shadow-md shadow-[#5D38FD]/20">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="font-display font-black text-slate-800 text-sm tracking-tight">Estagiário 2.0</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if(confirm('Deseja limpar todos os dados salvos?')) {
                    localStorage.removeItem('estagiario_state');
                    window.location.reload();
                  }
                }}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
                title="Limpar dados"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              
              {/* Profile avatar representation from the mockup */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#5D38FD] to-[#8063FD] flex items-center justify-center text-white shadow-md shadow-[#5D38FD]/25">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
          </header>

          {/* User Welcome Greeting block matching mockup */}
          <section className="mb-8 pl-2">
            <h1 className="text-3xl font-display font-black text-[#0f172a] tracking-tight leading-none mb-1">
              Olá, Professor(a)!
            </h1>
            <p className="text-[#64748b] text-sm font-medium">
              Tenha um ótimo dia de planejamento! 🍎
            </p>
          </section>

          {/* Filter pills section from the mockup */}
          <section className="mb-8">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
              {filterTabs.map((tab) => {
                const isActive = selectedFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedFilter(tab.id)}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all duration-300 whitespace-nowrap snap-start ${
                      isActive 
                        ? 'bg-[#5D38FD] text-white shadow-lg shadow-[#5D38FD]/20' 
                        : 'bg-white text-[#64748b] border border-[#e2eafc] hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tools Grid section with Purple Concentric Gradient Cards */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4 pl-2 uppercase tracking-[0.2em]">
              <h2 className="text-[10px] font-black text-[#64748b]">Ações de Apoio</h2>
              <div className="h-px bg-[#e2eafc] flex-1 ml-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setSelectedAction(tool.id);
                      setCurrentStep('planning');
                    }}
                    className="group relative flex flex-col items-start text-left p-6 rounded-[2.2rem] border border-[#e2eafc] bg-white transition-all duration-300 hover:shadow-xl hover:shadow-[#dae3f8]/40 hover:-translate-y-1 overflow-hidden min-h-[160px]"
                  >
                    {/* Background visual curves & rings matching the reference image */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2.2rem] opacity-30 group-hover:opacity-40 transition-opacity">
                      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border-[8px] border-indigo-100" />
                      <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full border-[10px] border-indigo-200" />
                      <div className="absolute -left-10 -top-10 w-24 h-24 rounded-full border-[4px] border-indigo-50" />
                    </div>

                    <div className="flex justify-between items-start w-full relative z-10 mb-4">
                      {/* Circle container for icon */}
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${tool.bgColor} ${tool.textColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      {/* Styled visual pill badge */}
                      <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-extrabold text-[#64748b] uppercase tracking-wider">
                        {tool.badge}
                      </span>
                    </div>

                    <div className="relative z-10">
                      <h3 className="font-display font-black text-slate-800 text-sm tracking-tight mb-1">
                        {tool.title}
                      </h3>
                      <p className="text-slate-500 text-xs font-normal leading-relaxed max-w-[280px]">
                        {tool.desc}
                      </p>
                    </div>

                    {/* Styled arrow button on bottom right */}
                    <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-slate-50 border border-[#e2eafc] flex items-center justify-center text-slate-400 group-hover:bg-[#5D38FD] group-hover:text-white group-hover:border-transparent transition-all shadow-sm">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Progress / History Section (styled like Progress at the bottom of the mockup) */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4 pl-2 uppercase tracking-[0.2em]">
              <h2 className="text-[10px] font-black text-[#64748b]">Seus Planejamentos Recentes</h2>
              <div className="h-px bg-[#e2eafc] flex-1 ml-4" />
            </div>

            {recentHistoryItems.length === 0 ? (
              <div className="bg-white border border-[#e2eafc] rounded-[2rem] p-8 text-center shadow-sm shadow-[#dae3f8]/10">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum histórico salvo</p>
                <p className="text-[11px] text-slate-400 mt-1">Gere um planejamento ou atividade para visualizá-lo aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentHistoryItems.slice(0, 5).map((item, idx) => {
                  const Icon = item.toolInfo?.icon || BookOpen;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedAction(item.toolId);
                        setCurrentIndices(prev => ({ ...prev, [item.toolId]: item.index }));
                        setCurrentStep('planning');
                      }}
                      className="group bg-white border border-[#e2eafc] p-4 rounded-[1.8rem] flex items-center justify-between gap-4 cursor-pointer hover:shadow-md hover:shadow-[#dae3f8]/30 hover:border-indigo-200 transition-all duration-200 relative overflow-hidden"
                    >
                      {/* Left border colored indicator matching reference design */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#5D38FD] to-[#8063FD]" />
                      
                      <div className="flex items-center gap-4 pl-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.toolInfo?.bgColor || 'bg-slate-100'} ${item.toolInfo?.textColor || 'text-slate-500'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        
                        <div className="min-w-0">
                          <p className="font-display font-bold text-slate-800 text-xs truncate">
                            {item.toolInfo?.title || 'Planejamento'}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                            Versão {item.index + 1} • Clique para visualizar
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => deleteHistoryItem(item.toolId, item.index, e)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir do histórico"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF2FC] font-sans pb-16 relative overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#dae3f8_1.2px,transparent_1.2px)] [background-size:24px_24px] pointer-events-none opacity-60" />

      <main className="relative max-w-7xl mx-auto px-4 pt-8 sm:px-6">
        
        {/* Top visual gradient header block matching the mockup */}
        <div className="bg-gradient-to-tr from-[#5D38FD] to-[#8063FD] text-white p-6 sm:p-8 rounded-[2.5rem] relative overflow-hidden mb-8 shadow-xl shadow-[#5D38FD]/20">
          {/* Abstract concentric vector lines from mockup */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full border-[10px] border-white" />
            <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full border-[12px] border-white" />
            <div className="absolute -left-10 -top-10 w-32 h-32 rounded-full border-[6px] border-white" />
          </div>
          
          <div className="relative flex justify-between items-center mb-6">
            <button 
              onClick={() => setCurrentStep('intro')}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/10"
              title="Voltar ao início"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            
            <h2 className="font-display font-black text-xs uppercase tracking-widest text-white/80">
              Painel de Criação
            </h2>
            
            <div className="w-10 h-10" /> {/* Spacer */}
          </div>
          
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg">
              {currentAction && <currentAction.icon className="w-6 h-6 text-white" />}
            </div>
            <div>
              <span className="text-white/60 text-[9px] font-black uppercase tracking-widest block">
                Ferramenta Ativa
              </span>
              <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white leading-none mt-1">
                {currentAction?.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Chat Side or Form Side */}
          {selectedAction === 'chat' ? (
            <aside className="lg:col-span-12 max-w-4xl mx-auto w-full bg-white p-6 sm:p-8 rounded-[2.2rem] border border-[#e2eafc] shadow-sm shadow-[#dae3f8]/20 flex flex-col h-[650px] relative overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="font-display font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#5D38FD]" /> 
                    Assistente Estagiário
                  </h2>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setChatViewMode('chat')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        chatViewMode === 'chat' ? 'bg-white text-[#5D38FD] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Conversa
                    </button>
                    <button 
                      onClick={() => setChatViewMode('memory')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        chatViewMode === 'memory' ? 'bg-white text-[#5D38FD] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Memória ({chatMemories.length})
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={clearChat}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors"
                    title="Limpar Chat"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setCurrentStep('intro')}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
                    title="Voltar"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {chatViewMode === 'chat' ? (
                <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8 opacity-60">
                      <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-[#5D38FD]">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-slate-500 max-w-sm leading-relaxed">
                        Olá, Professor Ramon! Eu sou o seu Assistente Pedagógico.<br/>
                        Envie um plano, tire dúvidas ou peça para eu gerar uma atividade com base na BNCC!
                      </p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === 'user' 
                          ? 'bg-[#5D38FD] text-white rounded-tr-none shadow-md shadow-[#5D38FD]/15' 
                          : 'bg-slate-100 text-slate-800 rounded-tl-none'
                      }`}>
                        {msg.parts.map((part, pIdx) => (
                          <div key={pIdx}>
                            {'text' in part && (
                              <div className="prose prose-sm max-w-none prose-p:my-0 prose-pre:my-0">
                                <Markdown>{part.text}</Markdown>
                              </div>
                            )}
                            {'inlineData' in part && (
                              <div className="mt-2 flex items-center gap-2 p-2 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                                <ImageIcon className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[150px]">Arquivo em anexo</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {msg.role === 'model' && (
                          <button 
                            onClick={() => {
                              const text = msg.parts.find(p => 'text' in p)?.text;
                              if (text) addMemory(text);
                            }}
                            className="absolute -right-8 top-0 p-1.5 bg-white border border-[#e2eafc] rounded-lg text-slate-400 hover:text-[#5D38FD] opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                            title="Salvar na memória"
                          >
                            <Sparkles className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-400 rounded-2xl rounded-tl-none px-4 py-3 text-xs animate-pulse">
                        Estágio pensando...
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
                  <div className="bg-[#EEF2FC] border border-[#e2eafc] rounded-2xl p-6 mb-6">
                    <h3 className="font-display font-black text-slate-800 text-sm mb-2 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-[#5D38FD]" />
                      Pontos Salvos na Memória
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Aqui estão os pontos importantes que eu salvei da nossa conversa para te ajudar melhor futuramente.
                    </p>
                  </div>
                  
                  {chatMemories.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center opacity-50">
                      <FileSearch className="w-7 h-7 mb-2 text-slate-300" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma memória salva</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {chatMemories.map((mem, idx) => (
                        <div key={idx} className="group bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-start gap-4 hover:border-indigo-200 transition-all">
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{mem}</p>
                          <button 
                            onClick={() => removeMemory(idx)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Adicionar Nota Manual</h4>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Ex: Aluno João tem dificuldade em frações..."
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5D38FD]/20 focus:border-[#5D38FD] transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            addMemory(e.currentTarget.value.trim());
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <button 
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          if (input.value.trim()) {
                            addMemory(input.value.trim());
                            input.value = '';
                          }
                        }}
                        className="bg-[#5D38FD] text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {chatFiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {chatFiles.map((file, fIdx) => (
                      <div key={fIdx} className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="p-1.5 bg-white rounded-lg text-[#5D38FD] flex-shrink-0">
                            <ImageIcon className="w-3 h-3" />
                          </div>
                          <span className="text-[10px] font-bold text-indigo-900 truncate">{file.name}</span>
                        </div>
                        <button 
                          onClick={() => setChatFiles(prev => prev.filter((_, i) => i !== fIdx))}
                          className="p-1 hover:bg-indigo-100 rounded-full transition-colors text-indigo-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-[#e2eafc] focus-within:ring-2 focus-within:ring-[#5D38FD]/10 focus-within:border-[#5D38FD] transition-all">
                  <input
                    type="file"
                    ref={chatFileInputRef}
                    className="hidden"
                    accept="*/*"
                    multiple
                    onChange={handleChatFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => chatFileInputRef.current?.click()}
                    className="w-11 h-11 bg-white border border-[#e2eafc] rounded-xl flex items-center justify-center text-slate-400 hover:text-[#5D38FD] transition-colors flex-shrink-0"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <textarea
                    rows={1}
                    placeholder="Peça uma atividade, tire uma dúvida ou descreva o plano de aula..."
                    className="flex-1 bg-transparent px-2 py-3 focus:outline-none text-xs sm:text-sm font-medium resize-none min-h-[44px] max-h-32 custom-scrollbar"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    disabled={loading}
                    style={{ height: 'auto', overflowY: 'auto' }}
                  />
                  <button
                    onClick={() => handleSendChat()}
                    disabled={loading || (!chatInput.trim() && chatFiles.length === 0)}
                    className="bg-[#5D38FD] text-white w-11 h-11 rounded-xl flex items-center justify-center hover:bg-[#4c2be0] transition-all disabled:opacity-50 flex-shrink-0 shadow-md shadow-[#5D38FD]/20"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </aside>
          ) : (
            <aside className="lg:col-span-5 w-full bg-white p-6 sm:p-8 rounded-[2.2rem] border border-[#e2eafc] shadow-sm shadow-[#dae3f8]/20">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                <h2 className="font-display font-black text-[#0f172a] text-sm uppercase tracking-wider flex items-center gap-2">
                  <PencilLine className="w-4 h-4 text-[#5D38FD]" /> 
                  Configurações
                </h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button 
                    onClick={() => setCurrentStep('intro')}
                    type="button"
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
                    title="Menu Inicial"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={clearForm}
                    type="button"
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors mr-1"
                    title="Limpar formulário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={fillSampleData}
                    type="button"
                    className="text-[10px] font-bold uppercase tracking-widest text-[#5D38FD] hover:text-[#4c2be0] flex items-center gap-1.5 transition-colors"
                    title="Preencher com exemplo"
                  >
                    <Zap className="w-4 h-4 animate-pulse" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ano / Turma</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: 3º Ano"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs"
                      value={form.grade}
                      onChange={e => setForm({ ...form, grade: e.target.value })}
                    />
                    {/* Fast selectors under input matching the mockup category selections */}
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {['3º Ano', '5º Ano', '9º Ano'].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setForm({ ...form, grade: val })}
                          className={`text-[9px] font-extrabold uppercase px-2 py-1 rounded-md border tracking-wider transition-colors ${
                            form.grade === val 
                              ? 'bg-[#5D38FD] text-white border-transparent' 
                              : 'bg-slate-50 hover:bg-slate-100 border-[#e2eafc] text-slate-500'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {selectedAction && (
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disciplina (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: Geografia (opcional)"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs"
                        value={form.discipline}
                        onChange={e => setForm({ ...form, discipline: e.target.value })}
                      />
                      {/* Fast selectors for common disciplines */}
                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {['Matemática', 'Português', 'Ciências'].map((val) => (
                          <button
                            type="button"
                            key={val}
                            onClick={() => setForm({ ...form, discipline: val })}
                            className={`text-[9px] font-extrabold uppercase px-2 py-1 rounded-md border tracking-wider transition-colors ${
                              form.discipline === val 
                                ? 'bg-[#5D38FD] text-white border-transparent' 
                                : 'bg-slate-50 hover:bg-slate-100 border-[#e2eafc] text-slate-500'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedAction === 'weekly' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qtd. de Semanas</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: 1 semana"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs"
                        value={form.weeksCount}
                        onChange={e => setForm({ ...form, weeksCount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aulas p/ Semana (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: 2 aulas (opcional)"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs"
                        value={form.classesCount}
                        onChange={e => setForm({ ...form, classesCount: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {selectedAction === 'macro' && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aulas p/ Semana (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 2 aulas (opcional)"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs"
                      value={form.classesCount}
                      onChange={e => setForm({ ...form, classesCount: e.target.value })}
                    />
                  </div>
                )}

                {selectedAction && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {selectedAction === 'essay' ? 'Texto da Redação / Critérios' : 
                       selectedAction === 'exercises' ? 'Conceito / Conteúdo da Atividade' :
                       selectedAction === 'macro' ? 'Diretrizes / Orientações do Professor' :
                       'Conteúdo / Habilidades a focar'}
                    </label>
                    <textarea
                      required
                      rows={selectedAction === 'essay' ? 8 : 4}
                      placeholder={
                        selectedAction === 'essay' ? 'Cole o texto escrito pelo aluno para obter a correção pedagógica detalhada...' :
                        selectedAction === 'macro' ? 'Instruções anuais: datas de projetos escolares, ênfases específicas do colégio...' :
                        'Descreva os conteúdos e assuntos a serem focados no planejamento...'
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs resize-none"
                      value={form.contents}
                      onChange={e => setForm({ ...form, contents: e.target.value })}
                    />
                  </div>
                )}

                {selectedAction === 'weekly' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incluir (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: Atividade lúdica"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs"
                        value={form.include}
                        onChange={e => setForm({ ...form, include: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evitar (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: Termos técnicos"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#5D38FD]/5 focus:border-[#5D38FD] transition-all font-medium text-xs"
                        value={form.avoid}
                        onChange={e => setForm({ ...form, avoid: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#5D38FD] text-white py-4.5 rounded-2xl font-bold hover:bg-[#4c2be0] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#5D38FD]/25 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Gerar Conteúdo</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </aside>
          )}

          {/* Output / Results section */}
          {selectedAction !== 'chat' && (
            <section className="lg:col-span-7 w-full flex flex-col gap-6">
              <div className="bg-white rounded-[2.2rem] border border-[#e2eafc] shadow-sm shadow-[#dae3f8]/20 overflow-hidden flex flex-col min-h-[600px]">
                
                {/* Visual Header styled cleanly like reference app */}
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-[#5D38FD] p-1.5 rounded-xl">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-display font-black text-xs uppercase tracking-wider text-white/90">Painel do Professor</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {output && (
                      <>
                        <button 
                          onClick={() => setShowSheetsModal(true)} 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-[9px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 tracking-wider shadow-sm shadow-emerald-950/30"
                          title="Exportar para Google Sheets"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>GOOGLE SHEETS</span>
                        </button>
                        <button 
                          onClick={handleCopy} 
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-[9px] font-extrabold border tracking-wider ${
                            copySuccess 
                            ? 'bg-green-500 border-green-600 text-white' 
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                          }`}
                          title="Copiar tabela"
                        >
                          {copySuccess ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copySuccess ? 'COPIADO' : 'COPIAR'}</span>
                        </button>
                      </>
                    )}
                    {currentIndex > 0 && (
                      <button 
                        onClick={handleUndo} 
                        className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 rounded-xl transition-colors text-[9px] font-extrabold bg-white/5 border border-white/10 tracking-wider"
                      >
                        <Undo2 className="w-3 h-3" /> 
                        <span>VOLTAR</span>
                      </button>
                    )}
                    {currentIndex < history.length - 1 && (
                      <button 
                        onClick={handleRedo} 
                        className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 rounded-xl transition-colors text-[9px] font-extrabold bg-white/5 border border-white/10 tracking-wider"
                      >
                        <Undo2 className="w-3 h-3 scale-x-[-1]" /> 
                        <span>AVANÇAR</span>
                      </button>
                    )}
                    {output && (
                      <button 
                        onClick={resetResult} 
                        className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
                        title="Reiniciar geração"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 overflow-auto custom-scrollbar bg-white">
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center text-center py-20"
                      >
                        <div className="relative mb-6">
                          <div className="w-16 h-16 border-4 border-slate-100 border-t-[#5D38FD] rounded-full animate-spin" />
                          <Sparkles className="w-5 h-5 text-[#5D38FD] absolute inset-0 m-auto animate-pulse" />
                        </div>
                        <h3 className="font-display font-black text-slate-800 text-lg mb-1">Gerando Planejamento</h3>
                        <p className="text-slate-400 text-xs max-w-[280px] leading-relaxed mx-auto">Consolidando habilidades da BNCC e metodologias ativas...</p>
                      </motion.div>
                    ) : output ? (
                      <div className="flex flex-col gap-6">
                        <div 
                          className={`markdown-body prose prose-slate max-w-none focus:outline-none ${
                            ['review', 'exam', 'exercises'].includes(selectedAction) 
                            ? 'prose-sheet px-5 py-8 sm:px-10 sm:py-12 bg-white shadow-md border border-[#e2eafc] rounded-3xl' 
                            : selectedAction === 'essay'
                            ? 'essay-correction px-5 py-6 sm:px-8 sm:py-8 bg-white border border-[#e2eafc] rounded-3xl shadow-sm'
                            : 'prose-sm'
                          }`}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newOutput = e.currentTarget.innerHTML;
                            if (newOutput !== output) {
                              const newHistory = [...history];
                              newHistory[currentIndex] = newOutput;
                              setHistories(prev => ({ ...prev, [selectedAction]: newHistory }));
                            }
                          }}
                        >
                          <Markdown 
                            remarkPlugins={[remarkGfm]} 
                            rehypePlugins={[rehypeRaw]}
                          >
                            {output.split('### REFERÊNCIA BNCC')[0]}
                          </Markdown>
                        </div>

                        {output.includes('### REFERÊNCIA BNCC') && (
                          <div className="mt-6 pt-6 border-t border-slate-100">
                            <h3 className="flex items-center gap-2 font-display font-black text-slate-800 text-xs uppercase tracking-wider mb-4">
                              <GraduationCap className="w-4 h-4 text-[#5D38FD]" />
                              Diretrizes BNCC Associadas
                            </h3>
                            <div className="bg-[#EEF2FC] p-5 rounded-2xl border border-[#e2eafc]">
                              <div className="markdown-body prose prose-slate text-[11px] leading-relaxed">
                                <Markdown 
                                  remarkPlugins={[remarkGfm]} 
                                  rehypePlugins={[rehypeRaw]}
                                >
                                  {output.split('### REFERÊNCIA BNCC')[1]}
                                </Markdown>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : error ? (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center text-center py-12 px-4"
                      >
                        {error.includes('depleted') || error.includes('RESOURCE_EXHAUSTED') || error.includes('429') || error.toLowerCase().includes('créditos') ? (
                          <div className="max-w-md bg-white rounded-[2rem] p-6 border border-amber-200 shadow-xl text-left">
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <h3 className="font-display font-black text-[#0f172a] text-base mb-1">
                              Faturamento ou Créditos Necessários
                            </h3>
                            <p className="text-slate-500 text-xs leading-relaxed mb-4">
                              Seus créditos gratuitos do Google AI Studio se esgotaram. Adicione créditos de faturamento pré-pago em seu painel do AI Studio para restabelecer os serviços.
                            </p>
                            <a
                              href="https://ai.studio/projects"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-[#5D38FD] hover:bg-[#4c2be0] text-white font-bold text-xs rounded-xl transition-colors gap-2"
                            >
                              Configurar AI Studio
                              <Rocket className="w-4 h-4" />
                            </a>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4">
                              <X className="w-5 h-5" />
                            </div>
                            <p className="text-red-600 text-xs font-semibold max-w-xs">{error}</p>
                          </>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col items-center justify-center text-center opacity-60 py-20"
                      >
                        <div className="bg-[#EEF2FC] w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <h3 className="font-display font-black text-slate-800 text-base mb-1">Resultado Aguardando</h3>
                        <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed mx-auto">Preencha e envie as configurações para iniciar a IA.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Refinement Panel at bottom of result */}
              <AnimatePresence>
                {output && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-[2.2rem] border border-[#e2eafc] shadow-sm shadow-[#dae3f8]/20"
                  >
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                      Ajustar ou Refinar Resultado
                    </label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        placeholder="Ex: Torne as questões um pouco mais fáceis..."
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs focus:outline-none focus:bg-white focus:border-[#5D38FD] transition-all font-medium"
                        value={refinement}
                        onChange={e => setRefinement(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRefine()}
                      />
                      <button
                        disabled={loading || !refinement.trim()}
                        onClick={handleRefine}
                        className="bg-[#5D38FD] text-white w-10 h-10 rounded-xl hover:bg-[#4c2be0] transition-all flex items-center justify-center disabled:opacity-50 shadow-md shadow-[#5D38FD]/20 flex-shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>

                    {history.length > 1 && (
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">Versões Geradas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {history.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => restoreVersion(idx)}
                              className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold transition-all border tracking-wider ${
                                idx === currentIndex 
                                ? 'bg-[#5D38FD] text-white border-transparent shadow-sm shadow-[#5D38FD]/10' 
                                : 'bg-slate-50 text-[#64748b] hover:text-[#5D38FD] border-[#e2eafc] hover:bg-[#EEF2FC]'
                              }`}
                            >
                              V{idx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </div>
      </main>

      {/* Google Sheets Export Modal */}
      <AnimatePresence>
        {showSheetsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden"
            >
              <button
                onClick={() => setShowSheetsModal(false)}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 flex-shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-black text-slate-900 text-lg">Exportar para o Google Sheets</h3>
                  <p className="text-slate-400 text-xs">Escolha a melhor forma de transferir seu planejamento</p>
                </div>
              </div>

              {sheetsExportSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2"
                >
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{sheetsExportSuccess}</span>
                </motion.div>
              )}

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleCopyForSheets(true)}
                  className="w-full p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 rounded-2xl flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl group-hover:scale-105 transition-transform flex-shrink-0">
                      <Copy className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-800">1. Copiar Tabela Principal (Recomendado)</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Copia a tabela de aulas sem mesclar células, perfeita para colar com Ctrl+V na célula A1</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleCopyForSheets(false)}
                  className="w-full p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 rounded-2xl flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-700 text-white rounded-xl group-hover:scale-105 transition-transform flex-shrink-0">
                      <Copy className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-800">2. Copiar Tabela Completa + Referências BNCC</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Copia a tabela principal e a tabela com as descrições detalhadas das habilidades da BNCC</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleDownloadCSV}
                  className="w-full p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 rounded-2xl flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl group-hover:scale-105 transition-transform flex-shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-800">3. Baixar Arquivo .CSV</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Gera um arquivo .csv UTF-8 pronto para importação via Arquivo &gt; Importar</span>
                    </div>
                  </div>
                </button>

                <a
                  href="https://sheets.new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 rounded-2xl flex items-center justify-between text-left transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl group-hover:scale-105 transition-transform flex-shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-800">4. Abrir Novo Google Sheets</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">Cria uma planilha em branco no seu Google Drive (sheets.new)</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 flex-shrink-0" />
                </a>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-[11px] text-emerald-900 leading-relaxed">
                💡 <strong>Como usar:</strong> Clique em <strong>"Copiar Tabela Principal"</strong>, abra o Google Sheets e pressione <strong>Ctrl + V</strong> na célula A1. As colunas (Disciplina, BNCC, Metodologia, Recursos e Local) ficarão alinhadas perfeitamente!
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Styled core tags & scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .markdown-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          border-radius: 1rem;
          overflow: hidden;
          border: 1px solid #e2eafc;
        }
        .markdown-body th, .markdown-body td {
          border: 1px solid #e2eafc;
          padding: 1rem;
          text-align: left;
          font-size: 0.8rem;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .markdown-body th {
          background-color: #f8fafc;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          border-bottom: 2px solid #e2eafc;
        }
        .markdown-body tr:nth-child(even) {
          background-color: #fcfdfe;
        }
        .markdown-body tr:hover {
          background-color: #f1f5f9;
        }
        .markdown-body strong {
          color: #0f172a;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
