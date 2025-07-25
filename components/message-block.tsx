"use client"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Copy, Check } from "lucide-react"

interface MessageBlockProps {
  role: "system" | "user" | "assistant"
  content: string
  onRoleChange: (role: "system" | "user" | "assistant") => void
  onContentChange: (content: string) => void
  onDelete: () => void
  onCopy: () => void
  isCopied: boolean
}

export function MessageBlock({
  role,
  content,
  onRoleChange,
  onContentChange,
  onDelete,
  onCopy,
  isCopied,
}: MessageBlockProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <Select value={role} onValueChange={onRoleChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">system</SelectItem>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="assistant">assistant</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCopy}>
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>

          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-500 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder={`${role} xabarini kiriting...`}
        className="min-h-[100px] resize-none"
      />
    </div>
  )
}
