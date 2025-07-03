"use client"

import {
  AlertCircleIcon,
  FileArchiveIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileUpIcon,
  HeadphonesIcon,
  ImageIcon,
  VideoIcon,
  XIcon,
  ArrowRightIcon,
  TrashIcon,
  Loader2,
} from "lucide-react"
import { useState } from "react"

import {
  formatBytes,
  useFileUpload,
} from "@/hooks/use-file-upload"
import { Button } from "@/components/ui/button"
import ExamesComparativoTable, { ExameStatus } from "@/components/exames-comparativo-table"

export type Message =
  | { content: string; isUser: boolean; type?: "text"; skipTyping?: boolean }
  | { content: ExameStatus[] | { exames_ocr: string[]; exames_brnet: string[] } | string; isUser: boolean; type: "tabela-exames"; skipTyping?: boolean };

const getFileIcon = (file: { file: File | { type: string; name: string } }) => {
  const fileType = file.file instanceof File ? file.file.type : file.file.type
  const fileName = file.file instanceof File ? file.file.name : file.file.name

  if (
    fileType.includes("pdf") ||
    fileName.endsWith(".pdf") ||
    fileType.includes("word") ||
    fileName.endsWith(".doc") ||
    fileName.endsWith(".docx")
  ) {
    return <FileTextIcon className="size-4 opacity-60" />
  } else if (
    fileType.includes("zip") ||
    fileType.includes("archive") ||
    fileName.endsWith(".zip") ||
    fileName.endsWith(".rar")
  ) {
    return <FileArchiveIcon className="size-4 opacity-60" />
  } else if (
    fileType.includes("excel") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx")
  ) {
    return <FileSpreadsheetIcon className="size-4 opacity-60" />
  } else if (fileType.includes("video/")) {
    return <VideoIcon className="size-4 opacity-60" />
  } else if (fileType.includes("audio/")) {
    return <HeadphonesIcon className="size-4 opacity-60" />
  } else if (fileType.startsWith("image/")) {
    return <ImageIcon className="size-4 opacity-60" />
  }
  return <FileIcon className="size-4 opacity-60" />
}

// Função para comparar exames usando OpenAI
async function compararExamesComOpenAI(examesOCR: string[] | string, examesBRNET: string[] | string): Promise<string> {
  // Garante que ambos sejam texto plano
  const examesOCRText = Array.isArray(examesOCR) ? examesOCR.map((e) => `- ${e}`).join("\n") : String(examesOCR);
  const examesBRNETText = Array.isArray(examesBRNET) ? examesBRNET.map((e) => `- ${e}`).join("\n") : String(examesBRNET);

  const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY; // ou substitua diretamente com a chave (com cautela)

  const prompt = `Compare as duas listas de exames abaixo. Use a lista do BRNET como referência principal. Para cada exame do BRNET, procure na lista do documento (OCR) se existe algum exame equivalente, mesmo que o nome seja diferente (exemplo: "Hemograma completo" e "exame de sangue" devem ser considerados equivalentes). Se encontrar, marque como presente e informe o nome correspondente do OCR. Se não encontrar, marque como ausente.

Para cada exame do BRNET, retorne um objeto com:
- exame: nome do exame do BRNET (exatamente como está na lista)
- presente_no_brnet: true
- presente_no_ocr: true/false
- versao_brnet: "Previsto"
- versao_ocr: nome do exame correspondente do OCR (ou "Não encontrado" se não houver)

ATENÇÃO: É OBRIGATÓRIO adicionar ao FINAL do array TODOS os exames do OCR que NÃO têm equivalente no BRNET, marcando:
- presente_no_brnet: false
- presente_no_ocr: true
- versao_brnet: "Não previsto"
- versao_ocr: nome do exame do OCR
- exame: nome do exame do OCR
SE VOCÊ NÃO ADICIONAR ESTES EXTRAS, A RESPOSTA ESTARÁ ERRADA.

Me devolva um array JSON, onde cada objeto tem a seguinte estrutura (nessa ordem de colunas):
[
  {
    "exame": "Hemograma completo",
    "presente_no_brnet": true,
    "presente_no_ocr": true,
    "versao_brnet": "Previsto",
    "versao_ocr": "exame de sangue"
  }
]

⚠️ Me retorne apenas o array JSON, sem explicações extras, sem comentários, sem markdown.

Exames do documento (OCR):\n${examesOCRText}

Exames previstos pelo BRNET:\n${examesBRNETText}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um assistente médico que compara exames de prontuário com os autorizados pelo sistema BRNET.",
        },
        {
          role: "user",
          content: prompt,
        }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Erro na OpenAI: ${error}`);
  }

  const data = await res.json();
  const resposta = data.choices[0].message.content;
  return resposta;
}

export default function Component({ onSystemMessage }: { onSystemMessage?: (msg: Message) => void }) {
  const maxSize = 100 * 1024 * 1024 // 10MB default
  const maxFiles = 10
  const [isImporting, setIsImporting] = useState(false)

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      clearFiles,
      getInputProps,
    },
  ] = useFileUpload({
    multiple: true,
    maxFiles,
    maxSize,
  })

  // Função para importar o arquivo para o backend
  const handleImport = async () => {
    if (files.length === 0 || isImporting) return;
  
    setIsImporting(true);
    onSystemMessage?.({ type: "text", content: "Recebi seu arquivo, aguarde um pouquinho enquanto analiso...", isUser: false });
  
    try {
      const formData = new FormData();
      let fileToSend = files[0].file;
      let fileName = files[0].file.name;
  
      if (!(fileToSend instanceof File)) {
        try {
          const fileMeta = files[0].file as {
            url: string;
            name: string;
            type: string;
          };
          const response = await fetch(fileMeta.url);
          const blob = await response.blob();
          fileToSend = new File([blob], fileMeta.name, { type: fileMeta.type });
        } catch (e) {
          console.error("❌ Erro ao obter arquivo remoto:", e);
          return;
        }
      }
  
      formData.append("arquivo", fileToSend, fileName);
  
      console.log("📤 Enviando arquivo para OCR...");
  
      const res = await fetch("http://localhost:8000/ocr", {
        method: "POST",
        body: formData,
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        console.error("❌ Erro do backend OCR:", data.erro || data);
        return;
      }
  
      console.log("✅ OCR finalizado:");
      console.log("→ CPF detectado:", data.cpf || "Não encontrado");
      onSystemMessage?.({ type: "text", content: `CPF detectado no documento: ${data.cpf || "Não encontrado"}`, isUser: false });
      console.log("→ Exames extraídos do OCR:", data.exames || "Nenhum");
      onSystemMessage?.({ type: "text", content: `Exames extraídos do documento: ${data.exames || "Nenhum"}`, isUser: false });
  
      if (!data.cpf) {
        console.warn("⚠️ Nenhum CPF encontrado. Interrompendo consulta BR MED.");
        onSystemMessage?.({ type: "text", content: "⚠️ Nenhum CPF encontrado. Interrompendo consulta BR MED.", isUser: false });
        return;
      }
  
      console.log("🔍 Enviando CPF para consultar BR MED...");
      onSystemMessage?.({ type: "text", content: "Usando o CPF para consulta no BRNET...", isUser: false });
  
      const rpaRes = await fetch("http://localhost:8000/consultar-brmed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: data.cpf }),
      });
  
      const rpaData = await rpaRes.json();
  
      if (!rpaRes.ok || rpaData.erro) {
        console.error("❌ Erro ao consultar BR MED:", rpaData.erro || rpaData);
        onSystemMessage?.({ type: "text", content: `❌ Erro ao consultar BR MED: ${rpaData.erro || rpaData}`, isUser: false });
        return;
      }
  
      console.log("✅ Dados do BR MED recebidos:");
      onSystemMessage?.({ type: "text", content: "Dados do BRNET extraídos com sucesso.", isUser: false });
      console.log("→ Nome:", rpaData.nome);
      onSystemMessage?.({ type: "text", content: `Nome: ${rpaData.nome}`, isUser: false });
      console.log("→ Exames do BR MED:", rpaData.exames || "Nenhum");
      onSystemMessage?.({ type: "text", content: `Exames do BRNET: ${rpaData.exames || "Nenhum"}`, isUser: false });

      // Chamar OpenAI para comparar exames
      if (data.exames && rpaData.exames) {
        try {
          onSystemMessage?.({ type: "text", content: "Vou analisar pra você...", isUser: false });
          const respostaOpenAI = await compararExamesComOpenAI(data.exames, rpaData.exames);
          let jsonString = respostaOpenAI.trim();
          // Remove blocos markdown se houver
          jsonString = jsonString.replace(/^```json/i, "");
          jsonString = jsonString.replace(/^```/, "");
          jsonString = jsonString.replace(/```$/, "");
          jsonString = jsonString.trim();

          try {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed) && parsed[0]?.exame) {
              onSystemMessage?.({ type: "tabela-exames", content: JSON.stringify(parsed), isUser: false, skipTyping: true });
              // Verifica se há exames do BRNET faltando no OCR
              const faltantes = parsed.filter(e => e.presente_no_brnet && !e.presente_no_ocr);
              if (faltantes.length > 0) {
                onSystemMessage?.({ type: "text", content: "Como há exames faltantes, não posso autorizar o envio deste documento. Inclua os exames necessários e tente novamente.", isUser: false });
              } else {
                onSystemMessage?.({ type: "text", content: "Como não há exames faltantes, posso autorizar o envio deste documento.", isUser: false });
              }
              return;
            }
          } catch {}
          onSystemMessage?.({ type: "text", content: respostaOpenAI, isUser: false, skipTyping: true });
        } catch (e: any) {
          onSystemMessage?.({ type: "text", content: "❌ Erro ao comparar exames com OpenAI: " + (e?.message || e), isUser: false });
        }
      }
  
    } catch (error) {
      console.error("❌ Erro geral no handleImport:", error);
    } finally {
      setIsImporting(false);
    }
  };
  
  return (
    <div className="flex flex-col gap-2">
      {/* Drop area */}
      <div
        role="button"
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
        className="border-input hover:bg-sidebar-ring/20 data-[dragging=true]:bg-slate-300 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed p-4 transition-colors has-disabled:pointer-events-none has-disabled:opacity-50 has-[input:focus]:ring-[3px]"
      >
        <input
          {...getInputProps({ disabled: isImporting })}
          className="sr-only"
          aria-label="Importar arquivos"
        />

        <div className="flex flex-col items-center justify-center text-center">
            <div
              className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
              aria-hidden="true"
            >
              <FileUpIcon className="size-4 opacity-60" />
            </div>
            <p className="text-muted-foreground mb-2 text-xs">
              Clique ou arraste e solte para importar seus documentos
            </p>
            <div className="text-muted-foreground/70 flex flex-wrap justify-center gap-1 text-xs">
              <span>Todos os arquivos</span>
              <span>∙</span>
              <span>Máximo {maxFiles} arquivos</span>
              <span>∙</span>
              <span>Até {formatBytes(maxSize)}</span>
            </div>
          </div>
       </div>

      {errors.length > 0 && (
        <div
          className="text-destructive flex items-center gap-1 text-xs"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-background flex items-center justify-between gap-2 rounded-lg border p-2 pe-3"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex aspect-square size-10 shrink-0 items-center justify-center rounded border">
                  {getFileIcon(file)}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate text-[13px] font-medium">
                    {file.file instanceof File
                      ? file.file.name
                      : file.file.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatBytes(
                      file.file instanceof File
                        ? file.file.size
                        : file.file.size
                    )}
                  </p>
                </div>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground/80 hover:text-foreground -me-2 size-8 hover:bg-transparent"
                onClick={() => removeFile(file.id)}
                aria-label="Remove file"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}

          {/* Remover todos os arquivos  e importar */}

          {files.length >= 1 && (
            <div className="flex justify-center mt-4 gap-4">
              <Button
              onClick={clearFiles}
              size="sm"
              variant="outline"
              disabled={isImporting}
              className="
                group 
                relative 
                inline-flex 
                items-center 
                justify-center 
                overflow-hidden
                px-6 py-2
                hover:bg-red-400/90
                mt-2
              "
            >
            {/* Texto centralizado e que só se move no hover */}
            <span
              className="
                transition-transform 
                duration-200 
                group-hover:-translate-x-3
              "
            >
              Remover
            </span>

            {/* Ícone absolutamente posicionado, invisível até o hover */}
            <TrashIcon
              className="
                size-4 
                absolute 
                top-1/2 
                right-3 
                -translate-y-1/2 
                opacity-0 
                transition-all 
                duration-200 
                group-hover:opacity-100
              "
            />
        </Button>

              <Button
              size="sm"
              variant="secondary"
              className="
                group 
                relative 
                inline-flex 
                items-center 
                justify-center 
                overflow-hidden
                px-6 py-2
                mt-2
              "
              onClick={handleImport}
              disabled={isImporting}
            >
            {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <span
                    className="
                transition-transform 
                duration-200 
                group-hover:-translate-x-3
              "
                  >
                    Importar
                  </span>
                  <ArrowRightIcon
                    className="
                size-4 
                absolute 
                top-1/2 
                right-3 
                -translate-y-1/2 
                opacity-0 
                transition-all 
                duration-200 
                group-hover:opacity-100
              "
                  />
                </>
              )}
        </Button>
             
            </div>
          )}
        </div>
      )}

    </div>
  )
}
