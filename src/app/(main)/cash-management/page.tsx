'use client'

import { useState, useMemo } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  Lock,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  useCashLedger,
  useCashSummary,
  useCreateCashEntry,
  useUpdateCashEntry,
  useDeleteCashEntry,
} from '@/hooks/use-cash-ledger'
import { useAuthStore } from '@/stores/use-auth-store'
import type { CashLedger } from '@/types/database'

const INCOME_CATEGORIES = [
  { value: '숙박', label: '숙박' },
  { value: '대실', label: '대실' },
  { value: '기타매출', label: '기타매출' },
  { value: '기타입금', label: '기타입금' },
]

const EXPENSE_CATEGORIES = [
  { value: '환불', label: '환불' },
  { value: '비품구매', label: '비품구매' },
  { value: '소모품', label: '소모품' },
  { value: '식비', label: '식비' },
  { value: '교통비', label: '교통비' },
  { value: '기타지출', label: '기타지출' },
]

const ENTRY_TYPE_CONFIG = {
  opening: { label: '시재금', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Wallet },
  income: { label: '입금', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: TrendingUp },
  expense: { label: '출금', color: 'text-red-600', bgColor: 'bg-red-50', icon: TrendingDown },
  closing: { label: '마감', color: 'text-green-600', bgColor: 'bg-green-50', icon: Lock },
} as const

type DialogMode = 'opening' | 'income' | 'expense' | 'closing' | null

export default function CashManagementPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const profile = useAuthStore((s) => s.profile)

  const { data: entries = [] } = useCashLedger(dateStr)
  const summary = useCashSummary(entries)
  const createEntry = useCreateCashEntry()
  const updateEntry = useUpdateCashEntry()
  const deleteEntry = useDeleteCashEntry()

  // 다이얼로그 상태
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [formCategory, setFormCategory] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState(0)
  const [formMemo, setFormMemo] = useState('')

  // 마감 정산 상태
  const [closingAmount, setClosingAmount] = useState(0)
  const [closingMemo, setClosingMemo] = useState('')

  const hasOpening = entries.some((e) => e.entry_type === 'opening')
  const hasClosing = entries.some((e) => e.entry_type === 'closing')

  // 입출금 내역 (시재금, 마감 제외)
  const transactionEntries = useMemo(
    () => entries.filter((e) => e.entry_type === 'income' || e.entry_type === 'expense'),
    [entries]
  )

  const resetForm = () => {
    setFormCategory('')
    setFormDescription('')
    setFormAmount(0)
    setFormMemo('')
  }

  const openDialog = (mode: DialogMode) => {
    resetForm()
    if (mode === 'opening') {
      setFormCategory('시재금')
      setFormDescription('영업 준비금')
    }
    setDialogMode(mode)
  }

  const handleSubmitEntry = async () => {
    if (!dialogMode) return
    if (dialogMode !== 'opening' && !formCategory) {
      toast.error('카테고리를 선택하세요.')
      return
    }
    if (formAmount <= 0) {
      toast.error('금액을 입력하세요.')
      return
    }

    try {
      await createEntry.mutateAsync({
        entry_date: dateStr,
        entry_type: dialogMode,
        category: dialogMode === 'opening' ? '시재금' : formCategory,
        description: formDescription || null,
        amount: formAmount,
        memo: formMemo || null,
        created_by: profile?.id ?? null,
      })
      toast.success(
        dialogMode === 'opening'
          ? '시재금이 설정되었습니다.'
          : dialogMode === 'income'
            ? '입금이 기록되었습니다.'
            : '출금이 기록되었습니다.'
      )
      setDialogMode(null)
      resetForm()
    } catch {
      toast.error('저장에 실패했습니다.')
    }
  }

  const handleClosing = async () => {
    try {
      await createEntry.mutateAsync({
        entry_date: dateStr,
        entry_type: 'closing',
        category: '마감정산',
        description: '일일 마감',
        amount: closingAmount,
        memo: closingMemo || null,
        created_by: profile?.id ?? null,
      })
      toast.success('마감이 확정되었습니다.')
      setClosingAmount(0)
      setClosingMemo('')
    } catch {
      toast.error('마감 처리에 실패했습니다.')
    }
  }

  const handleDelete = async (entry: CashLedger) => {
    const config = ENTRY_TYPE_CONFIG[entry.entry_type]
    const confirmed = window.confirm(
      `${config.label} | ${entry.category} | ${entry.amount.toLocaleString()}원\n\n이 기록을 삭제하시겠습니까?`
    )
    if (!confirmed) return
    try {
      await deleteEntry.mutateAsync(entry.id)
      toast.success('삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const goToPrevDay = () => setSelectedDate((d) => subDays(d, 1))
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1))

  return (
    <>
      <Header title="현금 시재 관리" />
      <div className="p-6 space-y-6">
        {/* 날짜 선택 */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px]">
                <CalendarDays className="h-4 w-4 mr-2" />
                {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ko}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
            오늘
          </Button>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wallet className="h-4 w-4 text-purple-500" />
                시재금 (준비금)
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {summary.opening.toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                현금 입금
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {summary.totalIncome.toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                현금 출금
              </div>
              <p className="text-2xl font-bold text-red-600">
                {summary.totalExpense.toLocaleString()}원
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Banknote className="h-4 w-4 text-green-500" />
                예상 시재
              </div>
              <p className="text-2xl font-bold text-green-600">
                {summary.expectedCash.toLocaleString()}원
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {!hasOpening && (
            <Button onClick={() => openDialog('opening')} variant="outline">
              <Wallet className="h-4 w-4 mr-1" />
              시재금 설정
            </Button>
          )}
          <Button onClick={() => openDialog('income')}>
            <Plus className="h-4 w-4 mr-1" />
            입금 기록
          </Button>
          <Button onClick={() => openDialog('expense')} variant="secondary">
            <TrendingDown className="h-4 w-4 mr-1" />
            출금 기록
          </Button>
        </div>

        {/* 입출금 내역 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">현금 입출금 내역</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">시간</TableHead>
                  <TableHead className="w-[70px]">구분</TableHead>
                  <TableHead className="w-[100px]">카테고리</TableHead>
                  <TableHead>내역</TableHead>
                  <TableHead className="text-right w-[120px]">금액</TableHead>
                  <TableHead className="min-w-[80px]">메모</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 시재금 행 */}
                {entries
                  .filter((e) => e.entry_type === 'opening')
                  .map((entry) => (
                    <TableRow key={entry.id} className="bg-purple-50/50">
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), 'HH:mm')}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-purple-600">시재금</span>
                      </TableCell>
                      <TableCell className="text-xs">{entry.category}</TableCell>
                      <TableCell className="text-xs">{entry.description ?? '-'}</TableCell>
                      <TableCell className="text-right font-medium text-purple-600">
                        {entry.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.memo ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDelete(entry)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                {/* 입출금 내역 */}
                {transactionEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      현금 입출금 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactionEntries.map((entry) => {
                    const config = ENTRY_TYPE_CONFIG[entry.entry_type]
                    const isIncome = entry.entry_type === 'income'
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), 'HH:mm')}
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-medium', config.color)}>
                            {config.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{entry.category}</TableCell>
                        <TableCell className="text-xs">{entry.description ?? '-'}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium',
                            isIncome ? 'text-blue-600' : 'text-red-600'
                          )}
                        >
                          {isIncome ? '+' : '-'}
                          {entry.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.memo ?? '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDelete(entry)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-bold">합계</TableCell>
                  <TableCell className="text-right font-bold">
                    {(summary.totalIncome - summary.totalExpense).toLocaleString()}원
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        {/* 마감 정산 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              마감 정산
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasClosing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">예상 시재</p>
                    <p className="text-xl font-bold">{summary.expectedCash.toLocaleString()}원</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">실제 시재</p>
                    <p className="text-xl font-bold">{(summary.closing ?? 0).toLocaleString()}원</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">과부족</p>
                    <p
                      className={cn(
                        'text-xl font-bold',
                        summary.difference === 0
                          ? 'text-green-600'
                          : (summary.difference ?? 0) > 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                      )}
                    >
                      {(summary.difference ?? 0) > 0 ? '+' : ''}
                      {(summary.difference ?? 0).toLocaleString()}원
                      <span className="text-sm font-normal ml-1">
                        {summary.difference === 0
                          ? '(일치)'
                          : (summary.difference ?? 0) > 0
                            ? '(초과)'
                            : '(부족)'}
                      </span>
                    </p>
                  </div>
                </div>
                {entries
                  .filter((e) => e.entry_type === 'closing')
                  .map((e) => (
                    <p key={e.id} className="text-sm text-muted-foreground">
                      {e.memo ? `비고: ${e.memo}` : ''}
                      {' | '}마감 시간: {format(new Date(e.created_at), 'HH:mm')}
                    </p>
                  ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">예상 시재</p>
                    <p className="text-xl font-bold">{summary.expectedCash.toLocaleString()}원</p>
                  </div>
                  <div className="space-y-2">
                    <Label>실제 시재 금액</Label>
                    <CurrencyInput
                      value={closingAmount}
                      onChange={setClosingAmount}
                      className="text-lg"
                    />
                  </div>
                </div>
                {closingAmount > 0 && (
                  <div className="p-3 rounded-lg border">
                    <span className="text-sm text-muted-foreground">과부족: </span>
                    <span
                      className={cn(
                        'font-bold',
                        closingAmount - summary.expectedCash === 0
                          ? 'text-green-600'
                          : closingAmount - summary.expectedCash > 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                      )}
                    >
                      {closingAmount - summary.expectedCash > 0 ? '+' : ''}
                      {(closingAmount - summary.expectedCash).toLocaleString()}원
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>비고</Label>
                  <Input
                    placeholder="마감 메모 (선택)"
                    value={closingMemo}
                    onChange={(e) => setClosingMemo(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleClosing}
                  disabled={closingAmount <= 0 || createEntry.isPending}
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-1" />
                  마감 확정
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 입금/출금/시재금 다이얼로그 */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'opening'
                ? '시재금 설정'
                : dialogMode === 'income'
                  ? '현금 입금 기록'
                  : '현금 출금 기록'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 카테고리 (시재금은 고정) */}
            {dialogMode !== 'opening' && (
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(dialogMode === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(
                      (cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* 내역 */}
            <div className="space-y-2">
              <Label>내역</Label>
              <Input
                placeholder={
                  dialogMode === 'opening'
                    ? '영업 준비금'
                    : dialogMode === 'income'
                      ? '예: 101호 홍길동'
                      : '예: 비품 구매'
                }
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            {/* 금액 */}
            <div className="space-y-2">
              <Label>금액</Label>
              <CurrencyInput value={formAmount} onChange={setFormAmount} />
            </div>
            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Input
                placeholder="메모"
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              취소
            </Button>
            <Button onClick={handleSubmitEntry} disabled={createEntry.isPending}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
