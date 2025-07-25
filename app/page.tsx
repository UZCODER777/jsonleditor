"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Plus, Trash2, Download, Upload, Save, Moon, Sun, Copy, Check, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatBlock {
  id: string
  messages: ChatMessage[]
}

export default function JSONLChatEditor() {
  const [blocks, setBlocks] = useState<ChatBlock[]>([])
  const [fileInfo, setFileInfo] = useState<{ name: string } | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Boshlang'ich blokni yaratish
    addNewBlock()
  }, [])

  // Generate unique ID
  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Add new message to a block
  const addMessage = useCallback((blockId: string, role: "system" | "user" | "assistant" = "user") => {
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              messages: [...block.messages, { role, content: "" }],
            }
          : block,
      ),
    )
    setHasUnsavedChanges(true)
  }, [])

  // Delete message from a block
  const deleteMessage = useCallback((blockId: string, messageIndex: number) => {
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              messages: block.messages.filter((_, index) => index !== messageIndex),
            }
          : block,
      ),
    )
    setHasUnsavedChanges(true)
  }, [])

  // Update message content
  const updateMessageContent = useCallback((blockId: string, messageIndex: number, content: string) => {
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              messages: block.messages.map((message, index) =>
                index === messageIndex ? { ...message, content } : message,
              ),
            }
          : block,
      ),
    )
    setHasUnsavedChanges(true)
  }, [])

  // Update message role
  const updateMessageRole = useCallback(
    (blockId: string, messageIndex: number, role: "system" | "user" | "assistant") => {
      setBlocks((prevBlocks) =>
        prevBlocks.map((block) =>
          block.id === blockId
            ? {
                ...block,
                messages: block.messages.map((message, index) =>
                  index === messageIndex ? { ...message, role } : message,
                ),
              }
            : block,
        ),
      )
      setHasUnsavedChanges(true)
    },
    [],
  )

  // Add new block
  const addNewBlock = useCallback(() => {
    const newBlock: ChatBlock = {
      id: generateId(),
      messages: [
        { role: "system", content: "" },
        { role: "user", content: "" },
        { role: "assistant", content: "" },
      ],
    }
    setBlocks((prevBlocks) => [...prevBlocks, newBlock])
    setHasUnsavedChanges(true)
  }, [])

  // Delete block
  const deleteBlock = useCallback((blockId: string) => {
    setBlocks((prevBlocks) => prevBlocks.filter((block) => block.id !== blockId))
    setHasUnsavedChanges(true)
  }, [])

  // Parse JSONL content
  const parseJSONL = useCallback(
    (content: string) => {
      try {
        // Avval bitta JSON obyekt sifatida parse qilishga harakat qilamiz
        try {
          const singleJson = JSON.parse(content.trim())

          // Agar messages array mavjud bo'lsa
          if (singleJson && typeof singleJson === "object" && Array.isArray(singleJson.messages)) {
            const newBlocks: ChatBlock[] = []
            let currentBlock: ChatMessage[] = []

            singleJson.messages.forEach((msg: any) => {
              if (msg && typeof msg === "object" && msg.role && msg.content) {
                if (["system", "user", "assistant"].includes(msg.role)) {
                  currentBlock.push({
                    role: msg.role as "system" | "user" | "assistant",
                    content: String(msg.content),
                  })

                  // Agar system->user->assistant ketma-ketligi bo'lsa, yangi block yaratamiz
                  if (
                    currentBlock.length === 3 &&
                    currentBlock[0].role === "system" &&
                    currentBlock[1].role === "user" &&
                    currentBlock[2].role === "assistant"
                  ) {
                    newBlocks.push({
                      id: generateId(),
                      messages: [...currentBlock],
                    })
                    currentBlock = []
                  }
                }
              }
            })

            // Qolgan xabarlarni ham qo'shamiz
            if (currentBlock.length > 0) {
              newBlocks.push({
                id: generateId(),
                messages: [...currentBlock],
              })
            }

            setBlocks(newBlocks)
            return
          }
        } catch (e) {
          // Bitta JSON sifatida parse bo'lmadi
        }

        // JSONL format (har qatorda alohida JSON)
        const lines = content.split("\n").filter((line) => line.trim() !== "")
        const parsedMessages: ChatMessage[] = []

        lines.forEach((line) => {
          try {
            const parsed = JSON.parse(line.trim())
            if (parsed && typeof parsed === "object" && parsed.role && parsed.content) {
              if (["system", "user", "assistant"].includes(parsed.role)) {
                parsedMessages.push({
                  role: parsed.role as "system" | "user" | "assistant",
                  content: String(parsed.content),
                })
              }
            }
          } catch (e) {
            // Xato bo'lsa o'tkazib yuboramiz
          }
        })

        // Xabarlarni blocklarga ajratamiz
        const newBlocks: ChatBlock[] = []
        let currentBlock: ChatMessage[] = []

        parsedMessages.forEach((msg) => {
          currentBlock.push(msg)

          // Agar system->user->assistant ketma-ketligi bo'lsa, yangi block yaratamiz
          if (
            currentBlock.length === 3 &&
            currentBlock[0].role === "system" &&
            currentBlock[1].role === "user" &&
            currentBlock[2].role === "assistant"
          ) {
            newBlocks.push({
              id: generateId(),
              messages: [...currentBlock],
            })
            currentBlock = []
          }
        })

        // Qolgan xabarlarni ham qo'shamiz
        if (currentBlock.length > 0) {
          newBlocks.push({
            id: generateId(),
            messages: [...currentBlock],
          })
        }

        setBlocks(
          newBlocks.length > 0
            ? newBlocks
            : [
                {
                  id: generateId(),
                  messages: [
                    { role: "system", content: "" },
                    { role: "user", content: "" },
                    { role: "assistant", content: "" },
                  ],
                },
              ],
        )
      } catch (error) {
        console.error("Error parsing content:", error)
        toast({
          title: "Xato",
          description: "Faylni o'qishda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  // File upload handler
  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        setFileInfo({ name: file.name })
        parseJSONL(text)
        setHasUnsavedChanges(false)
        toast({
          title: "Muvaffaqiyatli",
          description: "Fayl yuklandi",
        })
      } catch (error) {
        console.error("Error reading file:", error)
        toast({
          title: "Xato",
          description: "Faylni o'qishda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    },
    [parseJSONL, toast],
  )

  // File selection handler
  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (
        selectedFile.name.endsWith(".jsonl") ||
        selectedFile.name.endsWith(".json") ||
        selectedFile.type === "application/json"
      ) {
        handleFileUpload(selectedFile)
      } else {
        toast({
          title: "Noto'g'ri fayl formati",
          description: "Iltimos .jsonl yoki .json fayl tanlang",
          variant: "destructive",
        })
      }
    },
    [handleFileUpload, toast],
  )

  // Copy to clipboard
  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedText(text)
        setTimeout(() => setCopiedText(null), 2000)
        toast({
          title: "Nusxalandi",
          description: "Matn buferga nusxalandi",
        })
      } catch (error) {
        console.error("Failed to copy:", error)
        toast({
          title: "Xato",
          description: "Nusxalashda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    },
    [setCopiedText, toast],
  )

  // Download file
  const downloadFile = useCallback(
    (format: "jsonl" | "messages" = "jsonl") => {
      try {
        // Barcha xabarlarni yig'ish
        const allMessages: ChatMessage[] = []
        blocks.forEach((block) => {
          block.messages.forEach((message) => {
            if (message.content.trim() !== "") {
              allMessages.push(message)
            }
          })
        })

        if (allMessages.length === 0) {
          toast({
            title: "Xabarlar yo'q",
            description: "Yuklab olish uchun kamida bitta xabar kiriting",
            variant: "destructive",
          })
          return
        }

        let content: string
        let filename: string

        if (format === "messages") {
          // Messages array format
          const messagesObj = {
            messages: allMessages,
          }
          content = JSON.stringify(messagesObj, null, 2)
          filename = fileInfo?.name?.replace(".jsonl", ".json") || "chat.json"
        } else {
          // JSONL format
          content = allMessages.map((msg) => JSON.stringify(msg)).join("\n")
          filename = fileInfo?.name || "chat.jsonl"
        }

        const blob = new Blob([content], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setHasUnsavedChanges(false)

        toast({
          title: "Muvaffaqiyatli",
          description: `${filename} yuklab olindi`,
        })
      } catch (error) {
        console.error("Error downloading file:", error)
        toast({
          title: "Xato",
          description: "Faylni yuklab olishda xatolik yuz berdi",
          variant: "destructive",
        })
      }
    },
    [blocks, fileInfo, toast],
  )

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">JSONL Chat Editor</h1>
              {fileInfo && (
                <p className="text-xs text-muted-foreground">
                  {fileInfo.name}
                  {hasUnsavedChanges && <span className="text-orange-500 ml-2">• O'zgarishlar saqlanmagan</span>}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Fayl Yuklash
            </Button>

            <Button onClick={() => downloadFile("messages")} variant="outline" size="sm">
              <Save className="w-4 h-4 mr-2" />
              JSON
            </Button>

            <Button onClick={() => downloadFile("jsonl")} variant="default" size="sm">
              <Download className="w-4 h-4 mr-2" />
              JSONL
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Mavzu o'zgartirish</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Chat Blocks */}
        <div className="space-y-8">
          {blocks.map((block) => (
            <div key={block.id} className="border rounded-lg p-4 bg-background">
              {block.messages.map((message, messageIndex) => (
                <div key={`${block.id}_${messageIndex}`} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <Select
                      value={message.role}
                      onValueChange={(value: "system" | "user" | "assistant") =>
                        updateMessageRole(block.id, messageIndex, value)
                      }
                    >
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
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(message.content)}>
                        {copiedText === message.content ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMessage(block.id, messageIndex)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    value={message.content}
                    onChange={(e) => updateMessageContent(block.id, messageIndex, e.target.value)}
                    placeholder={`${message.role} xabarini kiriting...`}
                    className="min-h-[100px] resize-none"
                  />
                </div>
              ))}

              <div className="flex justify-between mt-4">
                <Button variant="outline" size="sm" onClick={() => addMessage(block.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Xabar qo'shish
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteBlock(block.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Blokni o'chirish
                </Button>
              </div>
            </div>
          ))}

          <Button onClick={addNewBlock} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Yangi blok qo'shish
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsonl,.json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
          className="hidden"
        />
      </main>

      <Toaster />
    </div>
  )
}
