"use client"

import React, { useMemo } from "react"

import { useState, useCallback, useRef, useEffect } from "react"
import { Plus, Trash2, Download, Upload, Save, Moon, Sun, Copy, Check, MessageSquare, X, FileText, Loader2, Pencil, Folder, LayoutGrid, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatBlock {
  id: string
  messages: ChatMessage[]
}

interface FileTab {
  id: string
  name: string
  blocks: ChatBlock[]
  hasUnsavedChanges: boolean
}

// Memoized Message component
interface MessageProps {
  blockId: string;
  message: ChatMessage;
  messageIndex: number;
  copiedText: string | null;
  updateMessageRole: (blockId: string, messageIndex: number, role: "system" | "user" | "assistant") => void;
  updateMessageContent: (blockId: string, messageIndex: number, content: string) => void;
  copyToClipboard: (text: string) => void;
  deleteMessage: (blockId: string, messageIndex: number) => void;
}
const Message: React.FC<MessageProps> = React.memo(function Message({ blockId, message, messageIndex, copiedText, updateMessageRole, updateMessageContent, copyToClipboard, deleteMessage }) {
  // Rolga qarab rangli border/fon/badge
  let roleClass = "";
  if (message.role === "system") roleClass = "border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950/40";
  else if (message.role === "user") roleClass = "border-l-4 border-green-400 bg-green-50 dark:bg-green-950/40";
  else if (message.role === "assistant") roleClass = "border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/40";

  return (
    <div className={`space-y-2 p-3 rounded-md ${roleClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={message.role}
            onValueChange={(value) => updateMessageRole(blockId, messageIndex, value as "system" | "user" | "assistant")}
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
          <span className={`px-2 py-0.5 rounded text-xs font-mono ${message.role === 'system' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : message.role === 'user' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'}`}>{message.role}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => copyToClipboard(message.content)}
            className="w-6 h-6 p-1 text-gray-400 opacity-60 hover:opacity-100 hover:text-blue-400 bg-transparent border-none shadow-none"
            title="Add"
          >
            {copiedText === message.content ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMessage(blockId, messageIndex)}
            className="w-6 h-6 p-1 text-gray-400 opacity-60 hover:opacity-100 hover:text-red-400 bg-transparent border-none shadow-none"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Textarea
        value={message.content}
        onChange={(e) => updateMessageContent(blockId, messageIndex, e.target.value)}
        placeholder={`Enter ${message.role} message...`}
        className="min-h-[80px] resize-none font-mono text-sm"
      />
    </div>
  )
})

// Memoized Block component
interface BlockProps {
  block: ChatBlock;
  blockIndex: number;
  copiedText: string | null;
  updateMessageRole: (blockId: string, messageIndex: number, role: "system" | "user" | "assistant") => void;
  updateMessageContent: (blockId: string, messageIndex: number, content: string) => void;
  copyToClipboard: (text: string) => void;
  deleteMessage: (blockId: string, messageIndex: number) => void;
  addMessage: (blockId: string) => void;
  deleteBlock: (blockId: string) => void;
}
const Block: React.FC<BlockProps> = React.memo(function Block({ block, blockIndex, copiedText, updateMessageRole, updateMessageContent, copyToClipboard, deleteMessage, addMessage, deleteBlock }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
      <div className="p-4 space-y-4">
        {block.messages.map((message, messageIndex) => (
          <Message
            key={`${block.id}_${messageIndex}`}
            blockId={block.id}
            message={message}
            messageIndex={messageIndex}
            copiedText={copiedText}
            updateMessageRole={updateMessageRole}
            updateMessageContent={updateMessageContent}
            copyToClipboard={copyToClipboard}
            deleteMessage={deleteMessage}
          />
        ))}
      </div>
      <div className="flex items-center justify-between p-4 border-t bg-gray-50 dark:bg-gray-700 rounded-b-lg">
        <Button
          onClick={() => addMessage(block.id)}
          variant="outline"
          size="sm"
          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
        >
          <Plus className="w-4 h-4 mr-2" /> Add message
        </Button>
        <Button
          onClick={() => deleteBlock(block.id)}
          variant="outline"
          size="sm"
          className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete block
        </Button>
      </div>
    </div>
  )
})

// JsonlPreview komponenti
function JsonlPreview({ tab }: { tab: FileTab }) {
  const [showSystem, setShowSystem] = React.useState(true);
  const [showUser, setShowUser] = React.useState(true);
  const [showAssistant, setShowAssistant] = React.useState(true);

  if (!tab) return null;
  return (
    <Accordion type="single" collapsible defaultValue="">
      <AccordionItem value="preview">
        <AccordionTrigger>
          <CardHeader className="p-0">
            <CardTitle>Preview</CardTitle>
          </CardHeader>
        </AccordionTrigger>
        <AccordionContent>
          <Card className="mb-6 border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              {/* Filter checkboxes */}
              <div className="flex gap-4 mb-4 items-center">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} />
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">system</span>
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={showUser} onChange={e => setShowUser(e.target.checked)} />
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">user</span>
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={showAssistant} onChange={e => setShowAssistant(e.target.checked)} />
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">assistant</span>
                </label>
              </div>
              <div className="space-y-4">
                {tab.blocks.length === 0 ? (
                  <div className="text-muted-foreground text-center">No blocks to preview</div>
                ) : (
                  tab.blocks.map((block, blockIdx) => (
                    <div key={block.id} className="border rounded p-3 bg-muted/30">
                      <div className="font-semibold text-xs mb-2 text-muted-foreground">Block {blockIdx + 1}</div>
                      <div className="space-y-2">
                        {block.messages
                          .filter(msg =>
                            (showSystem && msg.role === 'system') ||
                            (showUser && msg.role === 'user') ||
                            (showAssistant && msg.role === 'assistant')
                          )
                          .map((msg, msgIdx) => (
                            <div key={msgIdx} className="flex items-start gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-mono ${msg.role === 'system' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : msg.role === 'user' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'}`}>{msg.role}</span>
                              <span className="text-sm whitespace-pre-line font-mono">{msg.content || <span className="italic text-muted-foreground">(empty)</span>}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default function JSONLChatEditor() {
  const [fileTabs, setFileTabs] = useState<FileTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>("")
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    setMounted(true)
    // Create new tab
    createNewTab("default.jsonl")
  }, [])

  // Generate unique ID
  const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create new tab
  const createNewTab = useCallback((name: string) => {
    const newTab: FileTab = {
      id: generateId(),
      name,
      blocks: [
        {
          id: generateId(),
          messages: [
            { role: "system", content: "" },
            { role: "user", content: "" },
            { role: "assistant", content: "" },
          ],
        },
      ],
      hasUnsavedChanges: false,
    }
    setFileTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }, [])

  // Close tab
  const closeTab = useCallback(
    (tabId: string) => {
      setFileTabs((prev) => {
        const newTabs = prev.filter((tab) => tab.id !== tabId)
        if (newTabs.length === 0) {
          // If no tabs remain, create a new one
          const newTab: FileTab = {
            id: generateId(),
            name: "default.jsonl",
            blocks: [
              {
                id: generateId(),
                messages: [{ role: "user", content: "" }],
              },
            ],
            hasUnsavedChanges: false,
          }
          setActiveTabId(newTab.id)
          return [newTab]
        } else {
          // If the tab being closed is active, activate the next one
          if (tabId === activeTabId) {
            setActiveTabId(newTabs[0].id)
          }
          return newTabs
        }
      })
    },
    [activeTabId],
  )

  // Get active tab
  const activeTab = fileTabs.find((tab) => tab.id === activeTabId)

  // Update active tab
  const updateActiveTab = useCallback(
    (updater: (tab: FileTab) => FileTab) => {
      setFileTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? updater(tab) : tab)))
    },
    [activeTabId],
  )

  // Add new message to a block
  const addMessage = useCallback(
    (blockId: string, role: "system" | "user" | "assistant" = "user") => {
      updateActiveTab((tab) => ({
        ...tab,
        blocks: tab.blocks.map((block) =>
          block.id === blockId
            ? {
              ...block,
              messages: [...block.messages, { role, content: "" }],
            }
            : block,
        ),
        hasUnsavedChanges: true,
      }))
    },
    [updateActiveTab],
  )

  // Delete message from a block
  const deleteMessage = useCallback(
    (blockId: string, messageIndex: number) => {
      updateActiveTab((tab) => ({
        ...tab,
        blocks: tab.blocks.map((block) =>
          block.id === blockId
            ? {
              ...block,
              messages: block.messages.filter((_, index) => index !== messageIndex),
            }
            : block,
        ),
        hasUnsavedChanges: true,
      }))
    },
    [updateActiveTab],
  )

  // Update message content
  const updateMessageContent = useCallback(
    (blockId: string, messageIndex: number, content: string) => {
      updateActiveTab((tab) => ({
        ...tab,
        blocks: tab.blocks.map((block) =>
          block.id === blockId
            ? {
              ...block,
              messages: block.messages.map((message, index) =>
                index === messageIndex ? { ...message, content } : message,
              ),
            }
            : block,
        ),
        hasUnsavedChanges: true,
      }))
    },
    [updateActiveTab],
  )

  // Update message role
  const updateMessageRole = useCallback(
    (blockId: string, messageIndex: number, role: "system" | "user" | "assistant") => {
      updateActiveTab((tab) => ({
        ...tab,
        blocks: tab.blocks.map((block) =>
          block.id === blockId
            ? {
              ...block,
              messages: block.messages.map((message, index) =>
                index === messageIndex ? { ...message, role } : message,
              ),
            }
            : block,
        ),
        hasUnsavedChanges: true,
      }))
    },
    [updateActiveTab],
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
    updateActiveTab((tab) => ({
      ...tab,
      blocks: [...tab.blocks, newBlock],
      hasUnsavedChanges: true,
    }))
  }, [updateActiveTab])

  // Delete block
  const deleteBlock = useCallback(
    (blockId: string) => {
      updateActiveTab((tab) => ({
        ...tab,
        blocks: tab.blocks.filter((block) => block.id !== blockId),
        hasUnsavedChanges: true,
      }))
    },
    [updateActiveTab],
  )

  // Parse JSONL content
  const parseJSONL = useCallback(
    (content: string, fileName: string) => {
      console.log("Parsing content:", content.substring(0, 200) + "...")

      try {
        const trimmedContent = content.trim()
        if (!trimmedContent) {
          toast({
            title: "Empty file",
            description: "File is empty or contains only whitespace",
            variant: "destructive",
          })
          return
        }

        let newBlocks: ChatBlock[] = []

        // First, try to parse as a JSON object
        try {
          const jsonData = JSON.parse(trimmedContent)
          // Agar messages massivli bitta obyekt bo'lsa
          if (jsonData && typeof jsonData === "object" && Array.isArray(jsonData.messages)) {
            newBlocks.push({
              id: generateId(),
              messages: jsonData.messages.map((msg: any) => ({
                role: msg.role || "user",
                content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
              })),
            })
          } else if (Array.isArray(jsonData)) {
            // Agar massiv bo'lsa, har bir element messages massivli obyekt bo'lishi mumkin
            jsonData.forEach((item: any) => {
              if (item && Array.isArray(item.messages)) {
                newBlocks.push({
                  id: generateId(),
                  messages: item.messages.map((msg: any) => ({
                    role: msg.role || "user",
                    content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                  })),
                })
              }
            })
          }
        } catch (jsonError) {
          // JSONL format (each line is a JSON object)
          const lines = trimmedContent.split("\n")
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (line === "") continue
            try {
              const parsed = JSON.parse(line)
              if (parsed && typeof parsed === "object" && Array.isArray(parsed.messages)) {
                newBlocks.push({
                  id: generateId(),
                  messages: parsed.messages.map((msg: any) => ({
                    role: msg.role || "user",
                    content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                  })),
                })
              }
            } catch (lineError) {
              // Agar noto'g'ri qator bo'lsa, uni bitta block sifatida saqlaymiz
              newBlocks.push({
                id: generateId(),
                messages: [{ role: "user", content: line }],
              })
            }
          }
        }

        if (newBlocks.length === 0) {
          // Agar hech narsa topilmasa, butun matnni bitta block sifatida saqlaymiz
          newBlocks = [{ id: generateId(), messages: [{ role: "user", content: trimmedContent }] }]
        }

        // Create new tab or update existing one
        const newTab: FileTab = {
          id: generateId(),
          name: fileName,
          blocks: newBlocks,
          hasUnsavedChanges: false,
        }

        setFileTabs((prev) => [...prev, newTab])
        setActiveTabId(newTab.id)

        toast({
          title: "Successfully uploaded",
          description: `${newBlocks.reduce((acc, b) => acc + b.messages.length, 0)} messages, ${newBlocks.length} blocks loaded`,
        })
      } catch (error) {
        console.error("General parsing error:", error)
        toast({
          title: "Parsing error",
          description: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`,
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  // File upload handler
  const handleFileUpload = useCallback(
    async (files: FileList) => {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log("Uploading file:", file.name, file.size, file.type)

        try {
          if (file.size > 10 * 1024 * 1024) {
            // 10MB limit
            toast({
              title: "File too large",
              description: `${file.name} size must not exceed 10MB`,
              variant: "destructive",
            })
            continue
          }

          const text = await file.text()
          console.log("File content length:", text.length)

          parseJSONL(text, file.name)
        } catch (error) {
          console.error("Error reading file:", error)
          toast({
            title: "File read error",
            description: `${file.name} reading error: ${error instanceof Error ? error.message : "Unknown error"}`,
            variant: "destructive",
          })
        }
      }
    },
    [parseJSONL, toast],
  )

  // File selection handler
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files) return

      const validFiles: File[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.name.endsWith(".jsonl") || file.name.endsWith(".json") || file.type === "application/json") {
          validFiles.push(file)
        } else {
          toast({
            title: "Invalid file format",
            description: `${file.name} - only .jsonl or .json files are accepted`,
            variant: "destructive",
          })
        }
      }

      if (validFiles.length > 0) {
        const fileList = new DataTransfer()
        validFiles.forEach((file) => fileList.items.add(file))
        handleFileUpload(fileList.files)
      }

      // Clear input
      event.target.value = ""
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
          title: "Copied",
          description: "Text copied to clipboard",
        })
      } catch (error) {
        console.error("Failed to copy:", error)
        toast({
          title: "Error",
          description: "Copying failed",
          variant: "destructive",
        })
      }
    },
    [setCopiedText, toast],
  )

  // Download file
  const downloadFile = useCallback(
    (format: "jsonl" | "messages" = "jsonl", customTab?: FileTab) => {
      const tab = customTab || activeTab
      if (!tab) return

      try {
        // Collect all messages
        const allMessages: ChatMessage[] = []
        tab.blocks.forEach((block) => {
          block.messages.forEach((message) => {
            if (message.content.trim() !== "") {
              allMessages.push(message)
            }
          })
        })

        if (allMessages.length === 0) {
          toast({
            title: "No messages",
            description: "Please enter at least one message to load",
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
          filename = tab.name.replace(".jsonl", ".json") || "chat.json"
        } else {
          // Har bir blockni {messages: [...]} ko'rinishida alohida qator qilib yozamiz
          content = tab.blocks
            .filter((block) => block.messages.length > 0)
            .map((block) => JSON.stringify({ messages: block.messages }))
            .join("\n")
          filename = tab.name || "chat.jsonl"
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

        // Mark tab as saved
        updateActiveTab((tab) => ({ ...tab, hasUnsavedChanges: false }))

        toast({
          title: "Success",
          description: `${filename} downloaded`,
        })
      } catch (error) {
        console.error("Error downloading file:", error)
        toast({
          title: "Error",
          description: "Failed to download file",
          variant: "destructive",
        })
      }
    },
    [activeTab, updateActiveTab, toast],
  )

  // Sample data for testing
  const loadSampleData = useCallback(() => {
    if (!activeTab) return

    const sampleBlocks: ChatBlock[] = [
      {
        id: generateId(),
        messages: [
          { role: "system", content: "You are a helpful AI assistant." },
          { role: "user", content: "Hello! How can I help you?" },
          {
            role: "assistant",
            content:
              "Hello! I can answer questions, write text, and perform other tasks.",
          },
        ],
      },
    ]

    updateActiveTab((tab) => ({
      ...tab,
      blocks: sampleBlocks,
      hasUnsavedChanges: true,
    }))

    toast({
      title: "Sample data loaded",
      description: "Sample data loaded for testing",
    })
  }, [activeTab, updateActiveTab, toast])

  // Fayl nomini saqlash
  const saveTabName = (tabId: string) => {
    setFileTabs((prev) => prev.map((tab) => {
      if (tab.id === tabId) {
        // Faqat asosiy nomni yangilash, extensionni saqlash
        const ext = tab.name.endsWith('.jsonl') ? '.jsonl' : ''
        return { ...tab, name: editingName + ext, hasUnsavedChanges: true }
      }
      return tab
    }))
    setEditingTabId(null)
  }

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
              <p className="text-xs text-muted-foreground">{fileTabs.length} open files</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => createNewTab("default.jsonl")} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Tab
            </Button>

            <Button onClick={loadSampleData} variant="outline" size="sm">
              🧪 Test Data
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setIsUploading(true)
                  setUploadProgress(0)
                  for (let i = 1; i <= 100; i++) {
                    await new Promise((res) => setTimeout(res, 10))
                    setUploadProgress(i)
                  }
                  // Read file and parseJSONL (previous state)
                  const file = e.target.files[0]
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    try {
                      const text = event.target?.result as string
                      parseJSONL(text, file.name)
                    } catch (err) {
                      toast({ title: "Failed to read file", description: String(err), variant: "destructive" })
                    }
                    setIsUploading(false)
                  }
                  reader.readAsText(file)
                  e.target.value = "" // allow re-upload same file
                }
              }}
            />
            {/* Overlay progress bar in main UI */}
            {isUploading && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 flex flex-col items-center">
                  <div className="w-64 h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-blue-600 transition-all duration-100"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Uploading... {uploadProgress}%</span>
                </div>
              </div>
            )}

            <Button onClick={() => downloadFile("jsonl")} variant="default" size="sm" className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2">
              <Download className="w-4 h-4" />
              JSONL
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTabId} onValueChange={setActiveTabId} className="w-full">
          {/* Tab Headers */}
          <TabsList className="flex w-full gap-2 bg-transparent mb-6 justify-start">
            {fileTabs.map((tab) => (
              <div key={tab.id} className="flex items-center">
                <TabsTrigger
                  value={tab.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${activeTabId === tab.id
                      ? "bg-green-600 text-white shadow border border-green-700"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"}`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="truncate">{tab.name}</span>
                  {tab.hasUnsavedChanges && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full" />}
                </TabsTrigger>
                {fileTabs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => closeTab(tab.id)}
                    className="ml-1 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </TabsList>

          {/* Tab Contents */}
          {fileTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              <div className="flex flex-col gap-4 w-full"> {/* Block container boshlandi */}
                {/* File information */}
                <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
                  <h3 className="font-semibold mb-2">File information:</h3>
                  <div className="flex items-center gap-2 mb-1">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">File name:</span>
                    {editingTabId === tab.id ? (
                      <>
                        <input
                          className="border rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-green-500 bg-transparent dark:bg-gray-900"
                          value={editingName}
                          autoFocus
                          onChange={e => setEditingName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                          onBlur={() => saveTabName(tab.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveTabName(tab.id)
                            if (e.key === "Escape") setEditingTabId(null)
                          }}
                          maxLength={48}
                        />
                        <span className="ml-1 text-muted-foreground text-sm select-none">.jsonl</span>
                        <button className="ml-1 text-green-600 hover:text-green-800" onClick={() => saveTabName(tab.id)}>
                          <Check className="w-4 h-4" />
                        </button>
                        <button className="ml-1 text-gray-400 hover:text-red-500" onClick={() => setEditingTabId(null)}>
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="truncate max-w-xs inline-block align-middle">{tab.name}</span>
                        <button
                          className="ml-1 text-gray-400 hover:text-green-600"
                          title="Edit file name"
                          onClick={() => {
                            setEditingTabId(tab.id)
                            // Faqat asosiy nomni inputga joylash
                            setEditingName(tab.name.replace(/\.jsonl$/, ""))
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                    <LayoutGrid className="w-4 h-4 mr-1" /> Total blocks: {tab.blocks.length}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 mr-1" /> Total messages: {tab.blocks.reduce((total, block) => total + block.messages.length, 0)}
                  </div>
                  {tab.hasUnsavedChanges && (
                    <div className="text-sm text-orange-500 flex items-center gap-2 mt-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Unsaved changes</span>
                      <button
                        className="ml-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1 text-xs font-semibold shadow"
                        onClick={() => {
                          downloadFile("jsonl", tab)
                          setFileTabs((prev) => prev.map(t => t.id === tab.id ? { ...t, hasUnsavedChanges: false } : t))
                        }}
                        title="Save changes"
                      >
                        <Download className="w-4 h-4" /> Save
                      </button>
                    </div>
                  )}
                </div>
                {/* Preview bo'limi */}
                <JsonlPreview tab={tab} />

                {/* Chat Blocks */}
                <div className="space-y-6">
                  {tab.blocks.map((block, blockIndex) => (
                    <Block
                      key={block.id}
                      block={block}
                      blockIndex={blockIndex}
                      copiedText={copiedText}
                      updateMessageRole={updateMessageRole}
                      updateMessageContent={updateMessageContent}
                      copyToClipboard={copyToClipboard}
                      deleteMessage={deleteMessage}
                      addMessage={addMessage}
                      deleteBlock={deleteBlock}
                    />
                  ))}

                  {/* Add New Block Button */}
                  <div className="text-center">
                    <Button onClick={addNewBlock} className="bg-green-600 hover:bg-green-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Add message block
                    </Button>
                  </div>

                  {tab.blocks.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg mb-2">No blocks yet</p>
                      <p className="text-sm">Click the button above to add a new block</p>
                    </div>
                  )}
                </div>
              </div> {/* Block container tugadi */}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Toaster />
    </div>
  )
}
