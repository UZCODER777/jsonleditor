"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import {
  Upload,
  FileText,
  Moon,
  Sun,
  Plus,
  Edit3,
  Trash2,
  Play,
  Download,
  CheckCircle,
  Code,
  Database,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface JSONLBlock {
  id: string
  name: string
  data: any[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

interface ValidationResult {
  isValid: boolean
  totalLines: number
  validLines: number
  errors: Array<{ line: number; error: string }>
}

interface ExecutionResult {
  success: boolean
  output: string
  error?: string
  modifiedBlocks?: JSONLBlock[]
}

export default function JSONLBuilder() {
  const [blocks, setBlocks] = useState<JSONLBlock[]>([
    {
      id: "default",
      name: "Default",
      data: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
  const [activeBlockId, setActiveBlockId] = useState("default")
  const [customCode, setCustomCode] = useState(`// Use 'blocks' variable to manipulate data
// Available methods: console.log, JSON.stringify, JSON.parse
// Example transformations:

// Add timestamp to all items
blocks.forEach(block => {
  block.data = block.data.map(item => ({
    ...item,
    timestamp: new Date().toISOString()
  }));
});

// Filter messages by role
const userMessages = blocks.flatMap(block => 
  block.data.filter(item => 
    item.messages && item.messages.some(msg => msg.role === 'user')
  )
);

console.log('Total blocks:', blocks.length);
console.log('Total items:', blocks.reduce((sum, block) => sum + block.data.length, 0));
console.log('User message blocks:', userMessages.length);`)
  const [generatedJSONL, setGeneratedJSONL] = useState("")
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [newBlockName, setNewBlockName] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState<Message>({ role: "user", content: "" })
  const [isAddingMessage, setIsAddingMessage] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [isDragOver, setIsDragOver] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [savedProjects, setSavedProjects] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadSavedProjects()
  }, [])

  const activeBlock = blocks.find((block) => block.id === activeBlockId)

  // Local Storage Functions
  const saveProject = (name: string) => {
    const project = {
      name,
      blocks,
      customCode,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(`jsonl-project-${name}`, JSON.stringify(project))
    loadSavedProjects()
  }

  const loadProject = (name: string) => {
    const saved = localStorage.getItem(`jsonl-project-${name}`)
    if (saved) {
      const project = JSON.parse(saved)
      setBlocks(project.blocks)
      setCustomCode(project.customCode)
      setActiveBlockId(project.blocks[0]?.id || "default")
      generateJSONL(project.blocks)
    }
  }

  const loadSavedProjects = () => {
    const projects: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith("jsonl-project-")) {
        projects.push(key.replace("jsonl-project-", ""))
      }
    }
    setSavedProjects(projects)
  }

  const createNewBlock = () => {
    const newId = `block_${Date.now()}`
    const newBlock: JSONLBlock = {
      id: newId,
      name: `Block ${blocks.length + 1}`,
      data: [],
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setBlocks([...blocks, newBlock])
    setActiveBlockId(newId)
    setIsMobileMenuOpen(false)
  }

  const deleteBlock = (blockId: string) => {
    if (blocks.length === 1) return
    const newBlocks = blocks.filter((block) => block.id !== blockId)
    setBlocks(newBlocks)
    if (activeBlockId === blockId) {
      setActiveBlockId(newBlocks[0].id)
    }
    setIsMobileMenuOpen(false)
  }

  const renameBlock = (blockId: string, newName: string) => {
    setBlocks(
      blocks.map((block) => (block.id === blockId ? { ...block, name: newName, updatedAt: new Date() } : block)),
    )
    setIsRenameDialogOpen(false)
    setNewBlockName("")
  }

  const addMessage = () => {
    if (!newMessage.content.trim()) return
    const updatedMessages = [...messages, { ...newMessage }]
    setMessages(updatedMessages)
    setNewMessage({ role: "user", content: "" })
  }

  const removeMessage = (index: number) => {
    setMessages(messages.filter((_, i) => i !== index))
  }

  const addMessagesBlock = () => {
    if (messages.length === 0) return

    const messagesData = { messages: [...messages] }
    const updatedBlocks = blocks.map((block) =>
      block.id === activeBlockId ? { ...block, data: [...block.data, messagesData], updatedAt: new Date() } : block,
    )
    setBlocks(updatedBlocks)
    setMessages([])
    setIsAddingMessage(false)
    generateJSONL(updatedBlocks)
  }

  // Enhanced Code Execution with better error handling
  const executeCustomCode = async () => {
    setIsExecuting(true)
    setExecutionResult(null)

    try {
      // Create a deep copy of blocks for safe execution
      const blocksData = JSON.parse(JSON.stringify(blocks))
      const logs: string[] = []
      const errors: string[] = []

      // Create a safe execution environment
      const safeGlobals = {
        console: {
          log: (...args: any[]) => {
            logs.push(
              args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" "),
            )
          },
          error: (...args: any[]) => {
            errors.push(
              args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg))).join(" "),
            )
          },
        },
        JSON: JSON,
        Date: Date,
        Math: Math,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
      }

      // Execute code in a controlled environment
      const executeCode = new Function(
        "blocks",
        "console",
        "JSON",
        "Date",
        "Math",
        "Array",
        "Object",
        "String",
        "Number",
        "Boolean",
        `
        "use strict";
        try {
          ${customCode}
          return { success: true, blocks: blocks };
        } catch (error) {
          return { success: false, error: error.message };
        }
      `,
      )

      const result = executeCode(
        blocksData,
        safeGlobals.console,
        safeGlobals.JSON,
        safeGlobals.Date,
        safeGlobals.Math,
        safeGlobals.Array,
        safeGlobals.Object,
        safeGlobals.String,
        safeGlobals.Number,
        safeGlobals.Boolean,
      )

      if (result.success) {
        // Update blocks with execution results
        const updatedBlocks = result.blocks.map((block: any) => ({
          ...block,
          updatedAt: new Date(),
        }))
        setBlocks(updatedBlocks)
        generateJSONL(updatedBlocks)

        setExecutionResult({
          success: true,
          output: logs.length > 0 ? logs.join("\n") : "✅ Code executed successfully",
          modifiedBlocks: updatedBlocks,
        })
      } else {
        setExecutionResult({
          success: false,
          output: "",
          error: result.error,
        })
      }
    } catch (error) {
      setExecutionResult({
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "Unknown execution error",
      })
    } finally {
      setIsExecuting(false)
    }
  }

  // Enhanced JSONL Generation
  const generateJSONL = (blocksData = blocks) => {
    try {
      const allData: any[] = []
      blocksData.forEach((block) => {
        allData.push(...block.data)
      })

      const jsonlContent = allData.map((item) => JSON.stringify(item)).join("\n")
      setGeneratedJSONL(jsonlContent)
      return jsonlContent
    } catch (error) {
      console.error("Error generating JSONL:", error)
      return ""
    }
  }

  // Enhanced Validation
  const validateJSONL = () => {
    if (!generatedJSONL) {
      setValidationResult({
        isValid: false,
        totalLines: 0,
        validLines: 0,
        errors: [{ line: 0, error: "No JSONL content to validate" }],
      })
      return
    }

    const lines = generatedJSONL.split("\n").filter((line) => line.trim())
    let validLines = 0
    const errors: Array<{ line: number; error: string }> = []

    lines.forEach((line, index) => {
      try {
        JSON.parse(line)
        validLines++
      } catch (error) {
        errors.push({
          line: index + 1,
          error: error instanceof Error ? error.message : "Invalid JSON",
        })
      }
    })

    const result: ValidationResult = {
      isValid: errors.length === 0,
      totalLines: lines.length,
      validLines,
      errors,
    }

    setValidationResult(result)
  }

  // Enhanced File Operations
  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const lines = text.split("\n").filter((line) => line.trim())

        const data: any[] = []
        const errors: string[] = []

        lines.forEach((line, index) => {
          try {
            data.push(JSON.parse(line))
          } catch (error) {
            errors.push(`Line ${index + 1}: Invalid JSON`)
          }
        })

        const updatedBlocks = blocks.map((block) =>
          block.id === activeBlockId ? { ...block, data: [...block.data, ...data], updatedAt: new Date() } : block,
        )
        setBlocks(updatedBlocks)
        generateJSONL(updatedBlocks)

        setExecutionResult({
          success: true,
          output: `📁 File "${file.name}" uploaded successfully!\n✅ Loaded ${data.length} valid items${
            errors.length > 0 ? `\n⚠️ Skipped ${errors.length} invalid lines` : ""
          }`,
        })
      } catch (error) {
        setExecutionResult({
          success: false,
          output: "",
          error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
      }
    },
    [blocks, activeBlockId],
  )

  const downloadJSONL = () => {
    const content = generatedJSONL || generateJSONL()
    if (!content) return

    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `jsonl-export-${new Date().toISOString().split("T")[0]}.jsonl`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  // File drag and drop handlers
  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (
        selectedFile.type === "application/json" ||
        selectedFile.name.endsWith(".jsonl") ||
        selectedFile.name.endsWith(".json")
      ) {
        handleFileUpload(selectedFile)
      } else {
        setExecutionResult({
          success: false,
          output: "",
          error: "Please select a valid .jsonl or .json file",
        })
      }
    },
    [handleFileUpload],
  )

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

  const toggleItemExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  const clearActiveBlock = () => {
    const updatedBlocks = blocks.map((block) =>
      block.id === activeBlockId ? { ...block, data: [], updatedAt: new Date() } : block,
    )
    setBlocks(updatedBlocks)
    setGeneratedJSONL("")
    setExecutionResult({
      success: true,
      output: "🧹 Block cleared successfully",
    })
  }

  // Auto-generate JSONL when blocks change
  useEffect(() => {
    if (blocks.some((block) => block.data.length > 0)) {
      generateJSONL()
    }
  }, [blocks])

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
              <Database className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold">JSONL Builder Pro</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Save/Load Project */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Save className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save/Load Project</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="save">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="save">Save</TabsTrigger>
                    <TabsTrigger value="load">Load</TabsTrigger>
                  </TabsList>
                  <TabsContent value="save" className="space-y-4">
                    <div>
                      <Label htmlFor="projectName">Project Name</Label>
                      <Input
                        id="projectName"
                        placeholder="Enter project name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const input = e.target as HTMLInputElement
                            if (input.value.trim()) {
                              saveProject(input.value.trim())
                              input.value = ""
                            }
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const input = document.getElementById("projectName") as HTMLInputElement
                        if (input.value.trim()) {
                          saveProject(input.value.trim())
                          input.value = ""
                        }
                      }}
                    >
                      Save Project
                    </Button>
                  </TabsContent>
                  <TabsContent value="load" className="space-y-4">
                    <div className="space-y-2">
                      {savedProjects.length === 0 ? (
                        <p className="text-muted-foreground">No saved projects</p>
                      ) : (
                        savedProjects.map((project) => (
                          <div key={project} className="flex items-center justify-between p-2 border rounded">
                            <span>{project}</span>
                            <Button size="sm" onClick={() => loadProject(project)}>
                              Load
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Blocks ({blocks.length})</h2>
                  <div className="space-y-2">
                    {blocks.map((block) => (
                      <div
                        key={block.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          activeBlockId === block.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                        }`}
                        onClick={() => {
                          setActiveBlockId(block.id)
                          setIsMobileMenuOpen(false)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{block.name}</span>
                          <Badge variant="secondary">{block.data.length}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated: {block.updatedAt.toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={createNewBlock} className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      New
                    </Button>
                    <Button variant="outline" onClick={() => deleteBlock(activeBlockId)} disabled={blocks.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 md:py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - JSONL Blocks */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <Card className="h-fit">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    JSONL Blocks
                    <Badge variant="outline">{blocks.reduce((sum, block) => sum + block.data.length, 0)} items</Badge>
                  </CardTitle>

                  <div className="flex flex-wrap gap-2">
                    <Select value={activeBlockId} onValueChange={setActiveBlockId}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {blocks.map((block) => (
                          <SelectItem key={block.id} value={block.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{block.name}</span>
                              <Badge variant="secondary" className="ml-2">
                                {block.data.length}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="hidden lg:flex gap-2">
                      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Edit3 className="w-4 h-4 mr-1" />
                            Rename
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Rename Block</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="blockName">Block Name</Label>
                              <Input
                                id="blockName"
                                value={newBlockName}
                                onChange={(e) => setNewBlockName(e.target.value)}
                                placeholder={activeBlock?.name}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newBlockName.trim()) {
                                    renameBlock(activeBlockId, newBlockName.trim())
                                  }
                                }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  if (newBlockName.trim()) {
                                    renameBlock(activeBlockId, newBlockName.trim())
                                  }
                                }}
                                disabled={!newBlockName.trim()}
                              >
                                Rename
                              </Button>
                              <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteBlock(activeBlockId)}
                        disabled={blocks.length === 1}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>

                      <Button variant="outline" size="sm" onClick={createNewBlock}>
                        <Plus className="w-4 h-4 mr-1" />
                        New
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Dialog open={isAddingMessage} onOpenChange={setIsAddingMessage}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Add messages block
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                      <DialogHeader>
                        <DialogTitle>Add Messages Block</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 flex-1 overflow-hidden">
                        <div className="space-y-2">
                          <Label>Current Messages ({messages.length})</Label>
                          <ScrollArea className="h-40 border rounded-lg p-2">
                            <div className="space-y-2">
                              {messages.map((msg, index) => (
                                <div
                                  key={index}
                                  className="p-2 bg-muted rounded text-sm flex items-start justify-between"
                                >
                                  <div className="flex-1">
                                    <Badge
                                      variant={
                                        msg.role === "user"
                                          ? "default"
                                          : msg.role === "assistant"
                                            ? "secondary"
                                            : "outline"
                                      }
                                      className="mr-2 text-xs"
                                    >
                                      {msg.role}
                                    </Badge>
                                    <span className="break-words">{msg.content}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMessage(index)}
                                    className="ml-2 h-6 w-6 p-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                              {messages.length === 0 && (
                                <p className="text-muted-foreground text-center py-4">No messages added yet</p>
                              )}
                            </div>
                          </ScrollArea>
                        </div>

                        <div className="space-y-2">
                          <Label>Add New Message</Label>
                          <div className="flex gap-2">
                            <Select
                              value={newMessage.role}
                              onValueChange={(value: "user" | "assistant" | "system") =>
                                setNewMessage({ ...newMessage, role: value })
                              }
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="assistant">Assistant</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Message content"
                              value={newMessage.content}
                              onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault()
                                  addMessage()
                                }
                              }}
                              className="flex-1"
                            />
                            <Button onClick={addMessage} disabled={!newMessage.content.trim()}>
                              Add
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t">
                          <Button onClick={addMessagesBlock} disabled={messages.length === 0}>
                            Add to Block ({messages.length} messages)
                          </Button>
                          <Button variant="outline" onClick={() => setMessages([])}>
                            Clear All
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" />
                    Upload JSONL
                  </Button>

                  <Button variant="outline" size="sm" onClick={clearActiveBlock} disabled={!activeBlock?.data.length}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear Block
                  </Button>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(activeBlock?.data, null, 2))}
                          disabled={!activeBlock?.data.length}
                        >
                          {copiedText === JSON.stringify(activeBlock?.data, null, 2) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy block data as JSON</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

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

                <div
                  className={`min-h-96 border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
                    isDragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/25 bg-muted/20"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {activeBlock?.data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">No data in this block</p>
                        <p className="text-sm">Add messages, upload a JSONL file, or drag & drop here</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {activeBlock?.data.map((item, index) => (
                          <Collapsible
                            key={index}
                            open={expandedItems.has(index)}
                            onOpenChange={() => toggleItemExpanded(index)}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3 bg-background border rounded hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  {expandedItems.has(index) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  <Badge variant="outline">#{index + 1}</Badge>
                                  <span className="text-sm text-muted-foreground truncate max-w-48">
                                    {Object.keys(item).join(", ")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{Object.keys(item).length} keys</Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyToClipboard(JSON.stringify(item, null, 2))
                                    }}
                                    className="h-6 w-6 p-0"
                                  >
                                    {copiedText === JSON.stringify(item, null, 2) ? (
                                      <Check className="w-3 h-3" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 p-3 bg-muted/50 border rounded">
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(item, null, 2)}
                                </pre>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {activeBlock && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Items: {activeBlock.data.length}</span>
                    <span>Updated: {activeBlock.updatedAt.toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
            {/* Run Custom Code */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Code className="w-5 h-5" />
                    Custom Code
                  </CardTitle>
                  <Button onClick={executeCustomCode} size="sm" disabled={isExecuting}>
                    <Play className="w-4 h-4 mr-1" />
                    {isExecuting ? "Running..." : "Run"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="Use 'blocks' variable to manipulate data"
                  className="min-h-32 font-mono text-sm resize-none"
                />

                {executionResult && (
                  <Alert className={executionResult.success ? "border-green-200" : "border-red-200"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {executionResult.success ? (
                        <div className="space-y-2">
                          <div className="font-medium text-green-700 dark:text-green-400">✅ Success</div>
                          <pre className="whitespace-pre-wrap text-xs">{executionResult.output}</pre>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="font-medium text-red-700 dark:text-red-400">❌ Error</div>
                          <pre className="whitespace-pre-wrap text-xs text-red-600 dark:text-red-400">
                            {executionResult.error}
                          </pre>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Generated JSONL */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5" />
                    Generated JSONL
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadJSONL} disabled={!generatedJSONL}>
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={validateJSONL} disabled={!generatedJSONL}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Validate
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="min-h-48 border rounded-lg bg-muted/20 relative">
                  {generatedJSONL ? (
                    <>
                      <ScrollArea className="h-48 p-4">
                        <pre className="text-xs whitespace-pre-wrap break-all">{generatedJSONL}</pre>
                      </ScrollArea>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(generatedJSONL)}
                        className="absolute top-2 right-2"
                      >
                        {copiedText === generatedJSONL ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">No JSONL generated</p>
                        <p className="text-sm">Add data to blocks or run custom code</p>
                      </div>
                    </div>
                  )}
                </div>

                {generatedJSONL && (
                  <div className="text-xs text-muted-foreground">
                    {generatedJSONL.split("\n").filter((line) => line.trim()).length} lines generated
                  </div>
                )}

                {validationResult && (
                  <Alert className={validationResult.isValid ? "border-green-200" : "border-red-200"}>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div
                          className={`font-medium ${
                            validationResult.isValid
                              ? "text-green-700 dark:text-green-400"
                              : "text-red-700 dark:text-red-400"
                          }`}
                        >
                          {validationResult.isValid ? "✅ Valid JSONL" : "❌ Invalid JSONL"}
                        </div>
                        <div className="text-xs space-y-1">
                          <div>Total lines: {validationResult.totalLines}</div>
                          <div>Valid lines: {validationResult.validLines}</div>
                          {validationResult.errors.length > 0 && (
                            <div>
                              <div className="text-red-600 dark:text-red-400">
                                Errors ({validationResult.errors.length}):
                              </div>
                              <div className="max-h-20 overflow-y-auto">
                                {validationResult.errors.slice(0, 3).map((error, index) => (
                                  <div key={index} className="text-red-600 dark:text-red-400">
                                    Line {error.line}: {error.error}
                                  </div>
                                ))}
                                {validationResult.errors.length > 3 && (
                                  <div className="text-red-600 dark:text-red-400">
                                    ... and {validationResult.errors.length - 3} more errors
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
