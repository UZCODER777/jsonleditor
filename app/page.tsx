"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import {
  Upload,
  Moon,
  Sun,
  Plus,
  Trash2,
  Download,
  CheckCircle,
  Copy,
  Check,
  Search,
  RotateCcw,
  AlertTriangle,
  Save,
  MessageSquare,
  Bot,
  User,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"

interface ChatMessage {
  id: string
  role: "system" | "user" | "assistant"
  content: string
  isValid: boolean
  error?: string
}

interface ValidationResult {
  isValid: boolean
  totalMessages: number
  validMessages: number
  errors: Array<{ id: string; error: string }>
  warnings: Array<{ id: string; warning: string }>
}

interface FileInfo {
  name: string
  size: number
  lastModified: Date
  type: string
}

const ROLE_CONFIG = {
  system: {
    label: "System",
    icon: Settings,
    color: "bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    badgeColor: "bg-blue-500",
    placeholder: "Tizim ko'rsatmalarini kiriting...",
  },
  user: {
    label: "User",
    icon: User,
    color: "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    badgeColor: "bg-green-500",
    placeholder: "Foydalanuvchi xabarini kiriting...",
  },
  assistant: {
    label: "Assistant",
    icon: Bot,
    color: "bg-purple-100 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    badgeColor: "bg-purple-500",
    placeholder: "Assistant javobini kiriting...",
  },
}

const CHAT_TEMPLATES = [
  {
    name: "Oddiy suhbat",
    messages: [
      { role: "system" as const, content: "Siz foydali AI yordamchisiz." },
      { role: "user" as const, content: "Salom! Qanday yordam bera olasiz?" },
      {
        role: "assistant" as const,
        content:
          "Salom! Men turli savollarga javob berish, matn yozish, kod yozish va boshqa ko'plab vazifalarni bajarishda yordam bera olaman. Sizga qanday yordam kerak?",
      },
    ],
  },
  {
    name: "Kod yordamchisi",
    messages: [
      { role: "system" as const, content: "Siz tajribali dasturchi va kod yozishda yordam berasiz." },
      { role: "user" as const, content: "Python da API yaratishga yordam bering." },
      {
        role: "assistant" as const,
        content:
          "Albatta! FastAPI yordamida oddiy API yaratishni ko'rsataman:\n\n```python\nfrom fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get('/')\ndef read_root():\n    return {'message': 'Salom Dunyo!'}\n```",
      },
    ],
  },
  {
    name: "Ta'lim yordamchisi",
    messages: [
      {
        role: "system" as const,
        content: "Siz ta'lim sohasida yordam beruvchi AI yordamchisiz. Murakkab mavzularni oddiy tilda tushuntirasiz.",
      },
      { role: "user" as const, content: "Machine Learning nima?" },
      {
        role: "assistant" as const,
        content:
          "Machine Learning (Mashinani o'rgatish) - bu kompyuterga ma'lumotlardan o'rganish va bashorat qilish qobiliyatini beruvchi texnologiya. Masalan, emaildagi spamni aniqlash yoki rasmda nima borligini tanib olish.",
      },
    ],
  },
]

export default function JSONLChatEditor() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [originalContent, setOriginalContent] = useState("")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState<"all" | "system" | "user" | "assistant">("all")
  const [isDragOver, setIsDragOver] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoSave, setAutoSave] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Generate unique ID
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "s":
            e.preventDefault()
            if (hasUnsavedChanges) downloadFile()
            break
          case "n":
            e.preventDefault()
            addNewMessage()
            break
          case "f":
            e.preventDefault()
            document.getElementById("search-input")?.focus()
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasUnsavedChanges])

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && hasUnsavedChanges) {
      const timer = setTimeout(() => {
        downloadFile()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [autoSave, hasUnsavedChanges])

  // Parse JSONL content
  const parseJSONL = useCallback((content: string) => {
    setIsProcessing(true)
    const lines = content.split("\n")
    const parsedMessages: ChatMessage[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (trimmedLine === "") return

      try {
        const parsed = JSON.parse(trimmedLine)

        // Validate chat message format
        if (typeof parsed === "object" && parsed.role && parsed.content) {
          if (["system", "user", "assistant"].includes(parsed.role)) {
            parsedMessages.push({
              id: generateId(),
              role: parsed.role,
              content: parsed.content,
              isValid: true,
            })
          } else {
            parsedMessages.push({
              id: generateId(),
              role: "user",
              content: trimmedLine,
              isValid: false,
              error: `Noto'g'ri role: ${parsed.role}`,
            })
          }
        } else {
          parsedMessages.push({
            id: generateId(),
            role: "user",
            content: trimmedLine,
            isValid: false,
            error: "Chat format emas (role va content kerak)",
          })
        }
      } catch (error) {
        parsedMessages.push({
          id: generateId(),
          role: "user",
          content: trimmedLine,
          isValid: false,
          error: error instanceof Error ? error.message : "Noto'g'ri JSON",
        })
      }
    })

    setMessages(parsedMessages)
    setIsProcessing(false)
    validateContent(parsedMessages)
  }, [])

  // Validate content
  const validateContent = (msgs: ChatMessage[]) => {
    const errors: Array<{ id: string; error: string }> = []
    const warnings: Array<{ id: string; warning: string }> = []
    let validMessages = 0

    msgs.forEach((msg) => {
      if (msg.isValid) {
        validMessages++

        // Check for warnings
        if (msg.content.trim().length === 0) {
          warnings.push({ id: msg.id, warning: "Bo'sh xabar" })
        }
        if (msg.content.length > 5000) {
          warnings.push({ id: msg.id, warning: "Juda uzun xabar (>5000 belgi)" })
        }
      } else {
        errors.push({ id: msg.id, error: msg.error || "Noto'g'ri format" })
      }
    })

    const result: ValidationResult = {
      isValid: errors.length === 0,
      totalMessages: msgs.length,
      validMessages,
      errors,
      warnings,
    }

    setValidationResult(result)
  }

  // File upload handler
  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        setIsProcessing(true)
        const text = await file.text()

        setFileInfo({
          name: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified),
          type: file.type,
        })

        setOriginalContent(text)
        parseJSONL(text)
        setHasUnsavedChanges(false)
      } catch (error) {
        console.error("Error reading file:", error)
      } finally {
        setIsProcessing(false)
      }
    },
    [parseJSONL],
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
        alert("Iltimos .jsonl yoki .json fayl tanlang")
      }
    },
    [handleFileUpload],
  )

  // Drag and drop handlers
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFileSelect(droppedFile)
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  // Update message
  const updateMessage = (id: string, field: "role" | "content", value: string) => {
    const updatedMessages = messages.map((msg) => {
      if (msg.id === id) {
        const updated = { ...msg, [field]: value, isValid: true, error: undefined }
        return updated
      }
      return msg
    })
    setMessages(updatedMessages)
    setHasUnsavedChanges(true)
    validateContent(updatedMessages)
  }

  // Add new message
  const addNewMessage = (afterId?: string) => {
    const newMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: "",
      isValid: true,
    }

    if (afterId) {
      const index = messages.findIndex((msg) => msg.id === afterId)
      const updatedMessages = [...messages]
      updatedMessages.splice(index + 1, 0, newMessage)
      setMessages(updatedMessages)
    } else {
      setMessages([...messages, newMessage])
    }

    setHasUnsavedChanges(true)
    validateContent([...messages, newMessage])
  }

  // Delete message
  const deleteMessage = (id: string) => {
    const updatedMessages = messages.filter((msg) => msg.id !== id)
    setMessages(updatedMessages)
    setHasUnsavedChanges(true)
    validateContent(updatedMessages)
  }

  // Load template
  const loadTemplate = (templateName: string) => {
    const template = CHAT_TEMPLATES.find((t) => t.name === templateName)
    if (template) {
      const templateMessages: ChatMessage[] = template.messages.map((msg) => ({
        id: generateId(),
        role: msg.role,
        content: msg.content,
        isValid: true,
      }))
      setMessages(templateMessages)
      setHasUnsavedChanges(true)
      validateContent(templateMessages)
    }
  }

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  // Download file
  const downloadFile = () => {
    const content = messages
      .filter((msg) => msg.isValid)
      .map((msg) => JSON.stringify({ role: msg.role, content: msg.content }))
      .join("\n")

    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileInfo?.name || "chat.jsonl"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setHasUnsavedChanges(false)
  }

  // Reset to original
  const resetToOriginal = () => {
    if (originalContent) {
      parseJSONL(originalContent)
      setHasUnsavedChanges(false)
    }
  }

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    if (filterRole !== "all" && msg.role !== filterRole) return false

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      return (
        msg.content.toLowerCase().includes(searchLower) ||
        msg.role.toLowerCase().includes(searchLower) ||
        (msg.error && msg.error.toLowerCase().includes(searchLower))
      )
    }

    return true
  })

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
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
                  {fileInfo.name} • {(fileInfo.size / 1024).toFixed(1)}KB
                  {hasUnsavedChanges && <span className="text-orange-500 ml-2">• O'zgarishlar saqlanmagan</span>}
                  {autoSave && <span className="text-green-500 ml-2">• Avtomatik saqlash yoqilgan</span>}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Button onClick={downloadFile} size="sm" className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Saqlash (Ctrl+S)
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Mavzu o'zgartirish</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* File Upload Area */}
        {!fileInfo && messages.length === 0 && (
          <Card className="mb-6">
            <CardContent className="p-8">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">JSONL Chat Fayl Yuklash</h3>
                <p className="text-muted-foreground mb-4">
                  Chat formatidagi JSONL faylingizni bu yerga sudrab tashlang yoki tanlash uchun bosing
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => fileInputRef.current?.click()}>Fayl Tanlash</Button>
                  <Button variant="outline" onClick={() => loadTemplate("Oddiy suhbat")}>
                    Shablon Yuklash
                  </Button>
                </div>
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        {(fileInfo || messages.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            {/* Left Sidebar - Controls */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Boshqaruv</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Auto-save toggle */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-save" className="text-sm">
                      Avtomatik saqlash
                    </Label>
                    <Switch id="auto-save" checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>

                  {/* File Actions */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Fayl Amallar</Label>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="justify-start"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Yangi Yuklash
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadFile}
                        disabled={!hasUnsavedChanges}
                        className="justify-start bg-transparent"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Yuklab Olish
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetToOriginal}
                        disabled={!hasUnsavedChanges}
                        className="justify-start bg-transparent"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Qaytarish
                      </Button>
                    </div>
                  </div>

                  {/* Templates */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Shablonlar</Label>
                    <Select value={selectedTemplate} onValueChange={loadTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Shablon tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHAT_TEMPLATES.map((template) => (
                          <SelectItem key={template.name} value={template.name}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Search & Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Qidirish va Filtr</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="search-input"
                        placeholder="Qidirish... (Ctrl+F)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select
                      value={filterRole}
                      onValueChange={(value: "all" | "system" | "user" | "assistant") => setFilterRole(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Barcha Rollar</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Add New Message */}
                  <Button onClick={() => addNewMessage()} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Yangi Xabar (Ctrl+N)
                  </Button>

                  {/* Validation Results */}
                  {validationResult && (
                    <Alert className={validationResult.isValid ? "border-green-200" : "border-red-200"}>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <div
                            className={`font-medium ${validationResult.isValid ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
                          >
                            {validationResult.isValid ? "✅ To'g'ri Chat" : "❌ Xato Chat"}
                          </div>
                          <div className="text-xs space-y-1">
                            <div>Jami: {validationResult.totalMessages}</div>
                            <div>To'g'ri: {validationResult.validMessages}</div>
                            <div>Xatolar: {validationResult.errors.length}</div>
                            <div>Ogohlantirishlar: {validationResult.warnings.length}</div>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Chat Xabarlari
                      <Badge variant="outline">
                        {filteredMessages.length} / {messages.length} xabar
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                copyToClipboard(
                                  messages
                                    .filter((msg) => msg.isValid)
                                    .map((msg) => JSON.stringify({ role: msg.role, content: msg.content }))
                                    .join("\n"),
                                )
                              }
                            >
                              {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Barcha xabarlarni nusxalash</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isProcessing ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-muted-foreground">Chat qayta ishlanmoqda...</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-4">
                        {filteredMessages.map((message, index) => {
                          const roleConfig = ROLE_CONFIG[message.role]
                          const IconComponent = roleConfig.icon

                          return (
                            <div key={message.id}>
                              <Card className={`${roleConfig.color} ${!message.isValid ? "border-red-500" : ""}`}>
                                <CardContent className="p-4">
                                  {/* Message Header */}
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`w-6 h-6 ${roleConfig.badgeColor} rounded-full flex items-center justify-center`}
                                      >
                                        <IconComponent className="w-3 h-3 text-white" />
                                      </div>
                                      <Select
                                        value={message.role}
                                        onValueChange={(value: "system" | "user" | "assistant") =>
                                          updateMessage(message.id, "role", value)
                                        }
                                      >
                                        <SelectTrigger className="w-32 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="system">System</SelectItem>
                                          <SelectItem value="user">User</SelectItem>
                                          <SelectItem value="assistant">Assistant</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {!message.isValid && (
                                        <Badge variant="destructive" className="text-xs">
                                          <AlertTriangle className="w-3 h-3 mr-1" />
                                          Xato
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex gap-1">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => addNewMessage(message.id)}
                                              className="h-8 w-8 p-0"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Keyingi xabar qo'shish</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() =>
                                                copyToClipboard(
                                                  JSON.stringify({ role: message.role, content: message.content }),
                                                )
                                              }
                                              className="h-8 w-8 p-0"
                                            >
                                              {copiedText ===
                                              JSON.stringify({ role: message.role, content: message.content }) ? (
                                                <Check className="w-3 h-3" />
                                              ) : (
                                                <Copy className="w-3 h-3" />
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Xabarni nusxalash</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => deleteMessage(message.id)}
                                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Xabarni o'chirish</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>

                                  {/* Message Content */}
                                  <Textarea
                                    value={message.content}
                                    onChange={(e) => updateMessage(message.id, "content", e.target.value)}
                                    placeholder={roleConfig.placeholder}
                                    className="min-h-[100px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    style={{ boxShadow: "none" }}
                                  />

                                  {/* Error Display */}
                                  {!message.isValid && message.error && (
                                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200">
                                      <p className="text-sm text-red-600 dark:text-red-400">{message.error}</p>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Add button between messages */}
                              {index < filteredMessages.length - 1 && (
                                <div className="flex justify-center py-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => addNewMessage(message.id)}
                                          className="h-8 w-8 p-0 rounded-full opacity-0 hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Bu yerga yangi xabar qo'shish</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {filteredMessages.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Hech qanday xabar topilmadi</p>
                            <Button onClick={() => addNewMessage()} className="mt-4">
                              <Plus className="w-4 h-4 mr-2" />
                              Birinchi xabar qo'shish
                            </Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

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
    </div>
  )
}
