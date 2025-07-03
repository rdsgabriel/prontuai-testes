import { CheckIcon, XIcon, AlertTriangleIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ExameStatus = {
  exame: string;
  presente_no_ocr: boolean;
  presente_no_brnet: boolean;
  versao_ocr: string;
  versao_brnet: string;
};

export interface ExamesComparativoTableProps {
  exames: ExameStatus[];
}

function getConformidade(exame: ExameStatus) {
  if (exame.presente_no_brnet && exame.presente_no_ocr) {
    return { label: "Conforme", icon: <CheckIcon className="inline-flex stroke-emerald-600" size={16} />, color: "text-emerald-600" };
  }
  if (exame.presente_no_brnet && !exame.presente_no_ocr) {
    return { label: "Faltando no prontuário", icon: <XIcon className="inline-flex stroke-red-600" size={16} />, color: "text-red-600" };
  }
  if (!exame.presente_no_brnet && exame.presente_no_ocr) {
    return { label: "Não previsto (extra)", icon: <AlertTriangleIcon className="inline-flex stroke-yellow-500" size={16} />, color: "text-yellow-500" };
  }
  return { label: "-", icon: null, color: "text-muted-foreground" };
}

export default function ExamesComparativoTable({ exames }: ExamesComparativoTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/3">Exame previsto (BRNET)</TableHead>
          <TableHead className="w-1/3">No documento</TableHead>
          <TableHead className="w-1/3 text-center">Conformidade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {exames.map((item) => {
          const conf = getConformidade(item);
          return (
            <TableRow key={item.exame}>
              <TableCell className="font-medium px-4">
                {item.presente_no_brnet ? item.exame : <span className="text-muted-foreground text-xs">—</span>}
              </TableCell>
              <TableCell className="px-4">
                {item.presente_no_ocr ? (item.versao_ocr || item.exame) : <span className="text-muted-foreground text-xs">Não encontrado</span>}
              </TableCell>
              <TableCell className={`text-center font-medium px-4 ${conf.color}`}>
                <div className="flex flex-col items-center gap-1">
                  {conf.icon}
                  <span className="text-xs mt-1">{conf.label}</span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  )
} 