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
  id: string
  role: "system" | "user" | "assistant"
  content: string
}

export default function JSONLChatEditor() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [fileInfo, setFileInfo] = useState<{ name: string } | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Boshlang'ich xabarni yaratish
    addNewMessage()
  }, [])

  // Generate unique ID
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Add new message
  const addNewMessage = useCallback((role: "system" | "user" | "assistant" = "user") => {
    const newMessage: ChatMessage = {
      id: generateId(),
      role,
      content: "",
    }
    setMessages((prevMessages) => [...prevMessages, newMessage])
    setHasUnsavedChanges(true)
  }, [])

  // Delete message
  const deleteMessage = useCallback((messageId: string) => {
    setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== messageId))
    setHasUnsavedChanges(true)
  }, [])

  // Update message content
  const updateMessageContent = useCallback((messageId: string, content: string) => {
    setMessages((prevMessages) => prevMessages.map((msg) => (msg.id === messageId ? { ...msg, content } : msg)))
    setHasUnsavedChanges(true)
  }, [])

  // Update message role
  const updateMessageRole = useCallback((messageId: string, role: "system" | "user" | "assistant") => {
    setMessages((prevMessages) => prevMessages.map((msg) => (msg.id === messageId ? { ...msg, role } : msg)))
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

            // Har bir xabar uchun alohida message yaratamiz
            const newMessages: ChatMessage[] = jsonData.messages.map((msg: any) => ({
              id: generateId(),
              role: msg.role || "user",
              content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
            }))

            setMessages(newMessages)
            setHasUnsavedChanges(false)

            toast({
              title: "Muvaffaqiyatli yuklandi",
              description: `${jsonData.messages.length} ta xabar yuklandi`,
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
                  id: generateId(),
                  role: parsed.role as "system" | "user" | "assistant",
                  content: typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content),
                })
              } else if (parsed.messages && Array.isArray(parsed.messages)) {
                // Agar bu messages massivi bo'lsa
                parsed.messages.forEach((msg: any) => {
                  if (msg.role && msg.content) {
                    parsedMessages.push({
                      id: generateId(),
                      role: msg.role as "system" | "user" | "assistant",
                      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                    })
                  }
                })
              } else {
                console.log(`Line ${i + 1} has invalid format:`, parsed)
                parsedMessages.push({
                  id: generateId(),
                  role: "user",
                  content: JSON.stringify(parsed),
                })
              }
            }
          } catch (lineError) {
            console.log(`Line ${i + 1} parsing error:`, lineError)
            parsedMessages.push({
              id: generateId(),
              role: "user",
              content: line,
            })
          }
        }

        console.log("Parsed messages:", parsedMessages)

        if (parsedMessages.length === 0) {
          // Agar hech qanday xabar topilmasa, butun matnni bitta xabar sifatida ko'rsatamiz
          setMessages([
            {
              id: generateId(),
              role: "user",
              content: trimmedContent,
            },
          ])

          toast({
            title: "Format tanilmadi",
            description: "Fayl JSON yoki JSONL formatida emas, lekin matn ko'rsatilmoqda",
            variant: "destructive",
          })
          return
        }

        setMessages(parsedMessages)
        setHasUnsavedChanges(false)

        toast({
          title: "Muvaffaqiyatli yuklandi",
          description: `${parsedMessages.length} ta xabar yuklandi`,
        })
      } catch (error) {
        console.error("General parsing error:", error)
        toast({
          title: "Parsing xatosi",
          description: `Faylni o'qishda xatolik: ${error instanceof Error ? error.message : "Noma'lum xato"}`,
          variant: "destructive",
        })

        // Xato bo'lsa ham, asl matnni ko'rsatamiz
        setMessages([
          {
            id: generateId(),
            role: "user",
            content: content.substring(0, 1000) + (content.length > 1000 ? "..." : ""),
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
        // Faqat bo'sh bo'lmagan xabarlarni olish
        const validMessages = messages.filter((msg) => msg.content.trim() !== "")

        if (validMessages.length === 0) {
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
            messages: validMessages.map(({ id, ...msg }) => msg), // id ni olib tashlaymiz
          }
          content = JSON.stringify(messagesObj, null, 2)
          filename = fileInfo?.name?.replace(".jsonl", ".json") || "chat.json"
        } else {
          // JSONL format
          content = validMessages.map(({ id, ...msg }) => JSON.stringify(msg)).join("\n")
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
    [messages, fileInfo, toast],
  )

  // Test uchun sample data
  const loadSampleData = useCallback(() => {
    const sampleMessages: ChatMessage[] = [
      {
        id: generateId(),
        role: "system",
        content: "Siz foydali AI yordamchisiz.",
      },
      {
        id: generateId(),
        role: "user",
        content: "Salom! Qanday yordam bera olasiz?",
      },
      {
        id: generateId(),
        role: "assistant",
        content:
          "Salom! Men turli savollarga javob berish, matn yozish va boshqa vazifalarni bajarishda yordam bera olaman.",
      },
    ]
    setMessages(sampleMessages)
    setHasUnsavedChanges(true)
    toast({
      title: "Namuna yuklandi",
      description: "Test uchun namuna ma'lumotlar yuklandi",
    })
  }, [toast])

  // Clear all messages
  const clearAllMessages = useCallback(() => {
    setMessages([])
    setHasUnsavedChanges(true)
    toast({
      title: "Tozalandi",
      description: "Barcha xabarlar o'chirildi",
    })
  }, [toast])

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
            <Button onClick={loadSampleData} variant="outline" size="sm">
              🧪 Test Ma'lumot
            </Button>

            <Button
              onClick={clearAllMessages}
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
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">Fayl ma'lumotlari:</h3>
            <p className="text-sm text-muted-foreground">
              📁 Fayl nomi: {fileInfo.name}
              <br />📝 Jami xabarlar: {messages.length}
              <br />
              {hasUnsavedChanges && <span className="text-orange-500">⚠️ O'zgarishlar saqlanmagan</span>}
            </p>
          </div>
        )}

        {/* Message Blocks */}
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={message.id} className="border rounded-lg p-4 bg-background shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground font-mono">#{index + 1}</span>
                  <Select
                    value={message.role}
                    onValueChange={(value: "system" | "user" | "assistant") => updateMessageRole(message.id, value)}
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
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(message.content)}>
                    {copiedText === message.content ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMessage(message.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Textarea
                value={message.content}
                onChange={(e) => updateMessageContent(message.id, e.target.value)}
                placeholder={`${message.role} xabarini kiriting...`}
                className={`min-h-[120px] resize-none whitespace-pre-wrap font-mono text-sm ${
                  message.role === "system"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : message.role === "user"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                }`}
              />
            </div>
          ))}

          {/* Add new message buttons */}
          <div className="flex flex-wrap gap-2 justify-center pt-4">
            <Button onClick={() => addNewMessage("system")} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              System xabar
            </Button>
            <Button onClick={() => addNewMessage("user")} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              User xabar
            </Button>
            <Button onClick={() => addNewMessage("assistant")} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Assistant xabar
            </Button>
          </div>

          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Hech qanday xabar yo'q</p>
              <p className="text-sm">Yuqoridagi tugmalardan birini bosib yangi xabar qo'shing</p>
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
