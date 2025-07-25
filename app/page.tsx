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
      messages: [{ role: "user", content: "" }],
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
      console.log("Parsing content:", content.substring(0, 200) + "...")

      try {
        const trimmedContent = content.trim()
        if (!trimmedContent) {
          toast({
            title: "Bo'sh fayl",
            description: "Fayl bo'sh yoki faqat bo'sh joylardan iborat",
            variant: "destructive",
          })
          return
        }

        // Avval butun JSON obyekt sifatida parse qilishga harakat qilamiz
        try {
          const jsonData = JSON.parse(trimmedContent)
          console.log("Successfully parsed as JSON object:", jsonData)

          // "messages" massivi mavjud bo'lsa
          if (jsonData && typeof jsonData === "object" && Array.isArray(jsonData.messages)) {
            console.log("Messages array format detected with", jsonData.messages.length, "messages")

            // Xabarlarni bloklarga ajratamiz (har 3 ta xabar = 1 blok)
            const newBlocks: ChatBlock[] = []
            const messages = jsonData.messages.map((msg: any) => ({
              role: msg.role || "user",
              content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
            }))

            // Xabarlarni 3 tadan guruhlash
            for (let i = 0; i < messages.length; i += 3) {
              const blockMessages = messages.slice(i, i + 3)
              newBlocks.push({
                id: generateId(),
                messages: blockMessages,
              })
            }

            setBlocks(newBlocks)
            setHasUnsavedChanges(false)

            toast({
              title: "Muvaffaqiyatli yuklandi",
              description: `${jsonData.messages.length} ta xabar, ${newBlocks.length} ta blokda yuklandi`,
            })
            return
          }
        } catch (jsonError) {
          console.log("Not a valid JSON object, trying JSONL format:", jsonError)
        }

        // JSONL format (har qatorda alohida JSON)
        const lines = trimmedContent.split("\n")
        const parsedMessages: ChatMessage[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line === "") continue

          try {
            const parsed = JSON.parse(line)
            if (parsed && typeof parsed === "object") {
              if (parsed.role && parsed.content) {
                parsedMessages.push({
                  role: parsed.role as "system" | "user" | "assistant",
                  content: typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content),
                })
              } else if (parsed.messages && Array.isArray(parsed.messages)) {
                // Agar bu messages massivi bo'lsa
                parsed.messages.forEach((msg: any) => {
                  if (msg.role && msg.content) {
                    parsedMessages.push({
                      role: msg.role as "system" | "user" | "assistant",
                      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                    })
                  }
                })
              } else {
                console.log(`Line ${i + 1} has invalid format:`, parsed)
                parsedMessages.push({
                  role: "user",
                  content: JSON.stringify(parsed),
                })
              }
            }
          } catch (lineError) {
            console.log(`Line ${i + 1} parsing error:`, lineError)
            parsedMessages.push({
              role: "user",
              content: line,
            })
          }
        }

        console.log("Parsed messages:", parsedMessages)

        if (parsedMessages.length === 0) {
          // Agar hech qanday xabar topilmasa, butun matnni bitta xabar sifatida ko'rsatamiz
          setBlocks([
            {
              id: generateId(),
              messages: [{ role: "user", content: trimmedContent }],
            },
          ])

          toast({
            title: "Format tanilmadi",
            description: "Fayl JSON yoki JSONL formatida emas, lekin matn ko'rsatilmoqda",
            variant: "destructive",
          })
          return
        }

        // Xabarlarni bloklarga ajratamiz (har 3 ta xabar = 1 blok)
        const newBlocks: ChatBlock[] = []
        for (let i = 0; i < parsedMessages.length; i += 3) {
          const blockMessages = parsedMessages.slice(i, i + 3)
          newBlocks.push({
            id: generateId(),
            messages: blockMessages,
          })
        }

        setBlocks(newBlocks)
        setHasUnsavedChanges(false)

        toast({
          title: "Muvaffaqiyatli yuklandi",
          description: `${parsedMessages.length} ta xabar, ${newBlocks.length} ta blokda yuklandi`,
        })
      } catch (error) {
        console.error("General parsing error:", error)
        toast({
          title: "Parsing xatosi",
          description: `Faylni o'qishda xatolik: ${error instanceof Error ? error.message : "Noma'lum xato"}`,
          variant: "destructive",
        })

        // Xato bo'lsa ham, asl matnni ko'rsatamiz
        setBlocks([
          {
            id: generateId(),
            messages: [{ role: "user", content: content.substring(0, 1000) + (content.length > 1000 ? "..." : "") }],
          },
        ])
      }
    },
    [toast],
  )

  // File upload handler
  const handleFileUpload = useCallback(
    async (file: File) => {
      console.log("Uploading file:", file.name, file.size, file.type)

      try {
        if (file.size > 10 * 1024 * 1024) {
          // 10MB limit
          toast({
            title: "Fayl juda katta",
            description: "Fayl hajmi 10MB dan oshmasligi kerak",
            variant: "destructive",
          })
          return
        }

        const text = await file.text()
        console.log("File content length:", text.length)
        console.log("File content preview:", text.substring(0, 500))

        setFileInfo({ name: file.name })
        parseJSONL(text)
      } catch (error) {
        console.error("Error reading file:", error)
        toast({
          title: "Fayl o'qish xatosi",
          description: `Faylni o'qishda xatolik: ${error instanceof Error ? error.message : "Noma'lum xato"}`,
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

  // Test uchun sample data
  const loadSampleData = useCallback(() => {
    const sampleBlocks: ChatBlock[] = [
      {
        id: generateId(),
        messages: [
          { role: "system", content: "Siz foydali AI yordamchisiz." },
          { role: "user", content: "Salom! Qanday yordam bera olasiz?" },
          {
            role: "assistant",
            content:
              "Salom! Men turli savollarga javob berish, matn yozish va boshqa vazifalarni bajarishda yordam bera olaman.",
          },
        ],
      },
    ]
    setBlocks(sampleBlocks)
    setHasUnsavedChanges(true)
    toast({
      title: "Namuna yuklandi",
      description: "Test uchun namuna ma'lumotlar yuklandi",
    })
  }, [toast])

  // Clear all blocks
  const clearAllBlocks = useCallback(() => {
    setBlocks([])
    setHasUnsavedChanges(true)
    toast({
      title: "Tozalandi",
      description: "Barcha bloklar o'chirildi",
    })
  }, [toast])

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
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
            <Button onClick={loadSampleData} variant="outline" size="sm">
              🧪 Test Ma'lumot
            </Button>

            <Button
              onClick={clearAllBlocks}
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-700 bg-transparent"
            >
              🗑️ Tozalash
            </Button>

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
        {/* Debug uchun fayl ma'lumotlarini ko'rsatish */}
        {fileInfo && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
            <h3 className="font-semibold mb-2">Fayl ma'lumotlari:</h3>
            <p className="text-sm text-muted-foreground">
              📁 Fayl nomi: {fileInfo.name}
              <br />📊 Jami bloklar: {blocks.length}
              <br />📝 Jami xabarlar: {blocks.reduce((total, block) => total + block.messages.length, 0)}
              <br />
              {hasUnsavedChanges && <span className="text-orange-500">⚠️ O'zgarishlar saqlanmagan</span>}
            </p>
          </div>
        )}

        {/* Chat Blocks */}
        <div className="space-y-6">
          {blocks.map((block, blockIndex) => (
            <div key={block.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
              {/* Block Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 dark:bg-gray-700 rounded-t-lg">
                <Button
                  onClick={() => addMessage(block.id)}
                  variant="outline"
                  size="sm"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add message
                </Button>

                <Button
                  onClick={() => deleteBlock(block.id)}
                  variant="outline"
                  size="sm"
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete block
                </Button>
              </div>

              {/* Messages in Block */}
              <div className="p-4 space-y-4">
                {block.messages.map((message, messageIndex) => (
                  <div key={`${block.id}_${messageIndex}`} className="space-y-2">
                    <div className="flex items-center justify-between">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(message.content)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          {copiedText === message.content ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          Add
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMessage(block.id, messageIndex)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <Textarea
                      value={message.content}
                      onChange={(e) => updateMessageContent(block.id, messageIndex, e.target.value)}
                      placeholder={`${message.role} xabarini kiriting...`}
                      className="min-h-[80px] resize-none font-mono text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Block Footer */}
              <div className="flex items-center justify-between p-4 border-t bg-gray-50 dark:bg-gray-700 rounded-b-lg">
                <Button
                  onClick={() => addMessage(block.id)}
                  variant="outline"
                  size="sm"
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add message
                </Button>

                <Button
                  onClick={() => deleteBlock(block.id)}
                  variant="outline"
                  size="sm"
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete block
                </Button>
              </div>
            </div>
          ))}

          {/* Add New Block Button */}
          <div className="text-center">
            <Button onClick={addNewBlock} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add message block
            </Button>
          </div>

          {blocks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Hech qanday blok yo'q</p>
              <p className="text-sm">Yuqoridagi tugmani bosib yangi blok qo'shing</p>
            </div>
          )}
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
