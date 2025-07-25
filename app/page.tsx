"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import {
  Upload,
  FileText,
  Moon,
  Sun,
  Plus,
  Trash2,
  Download,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Search,
  RotateCcw,
  FileJson,
  AlertTriangle,
  Save,
  PlusCircle,
  Settings,
  Code,
  Zap,
  Type,
  Hash,
  ToggleLeft,
  Brackets,
  Braces,
  Quote,
  Wand2,
  Keyboard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"

interface ParsedLine {
  lineNumber: number
  content: string
  parsed?: any
  error?: string
  isValid: boolean
  isEditing?: boolean
  editMode?: "inline" | "visual" | "code"
}

interface ValidationResult {
  isValid: boolean
  totalLines: number
  validLines: number
  errors: Array<{ line: number; error: string }>
  warnings: Array<{ line: number; warning: string }>
}

interface FileInfo {
  name: string
  size: number
  lastModified: Date
  type: string
}

interface JsonField {
  key: string
  value: any
  type: "string" | "number" | "boolean" | "object" | "array" | "null"
  path: string
  isEditing?: boolean
  originalKey?: string
}

const JSON_TEMPLATES = [
  { name: "Bo'sh obyekt", value: "{}", icon: Braces },
  { name: "Foydalanuvchi", value: '{"id": 1, "name": "", "email": "", "active": true}', icon: Type },
  { name: "Mahsulot", value: '{"id": 1, "name": "", "price": 0, "category": "", "inStock": true}', icon: Hash },
  { name: "Xabar", value: '{"message": "", "timestamp": "", "user": "", "read": false}', icon: Quote },
  {
    name: "Maqola",
    value: '{"title": "", "content": "", "author": "", "publishDate": "", "tags": []}',
    icon: FileText,
  },
  { name: "API Response", value: '{"success": true, "data": {}, "message": "", "timestamp": ""}', icon: Code },
]

const COMMON_KEYS = [
  "id",
  "name",
  "title",
  "description",
  "email",
  "phone",
  "address",
  "city",
  "country",
  "price",
  "amount",
  "quantity",
  "total",
  "date",
  "timestamp",
  "created_at",
  "updated_at",
  "status",
  "active",
  "enabled",
  "visible",
  "published",
  "category",
  "type",
  "tags",
  "user",
  "author",
  "owner",
  "message",
  "content",
  "data",
  "value",
  "key",
]

export default function JSONLViewer() {
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([])
  const [originalContent, setOriginalContent] = useState("")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "valid" | "invalid">("all")
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set())
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [showRawContent, setShowRawContent] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingLine, setEditingLine] = useState<number | null>(null)
  const [editContent, setEditContent] = useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [jsonFields, setJsonFields] = useState<JsonField[]>([])
  const [editingField, setEditingField] = useState<string | null>(null)
  const [autoSave, setAutoSave] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
            addNewLine()
            break
          case "f":
            e.preventDefault()
            document.getElementById("search-input")?.focus()
            break
          case "z":
            if (e.shiftKey) {
              e.preventDefault()
              // Redo functionality
            } else {
              e.preventDefault()
              // Undo functionality
            }
            break
        }
      }
      if (e.key === "Escape") {
        if (editingLine !== null) {
          cancelEdit()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasUnsavedChanges, editingLine])

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
    const parsed: ParsedLine[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (trimmedLine === "") return

      try {
        const parsedData = JSON.parse(trimmedLine)
        parsed.push({
          lineNumber: index + 1,
          content: trimmedLine,
          parsed: parsedData,
          isValid: true,
          isEditing: false,
          editMode: "visual",
        })
      } catch (error) {
        parsed.push({
          lineNumber: index + 1,
          content: trimmedLine,
          error: error instanceof Error ? error.message : "Invalid JSON",
          isValid: false,
          isEditing: false,
          editMode: "code",
        })
      }
    })

    setParsedLines(parsed)
    setIsProcessing(false)
    validateContent(parsed)
  }, [])

  // Convert JSON to flat fields for editing
  const jsonToFields = (obj: any, parentPath = ""): JsonField[] => {
    const fields: JsonField[] = []

    const processValue = (key: string, value: any, path: string) => {
      let type: JsonField["type"] = "string"

      if (value === null) type = "null"
      else if (typeof value === "number") type = "number"
      else if (typeof value === "boolean") type = "boolean"
      else if (Array.isArray(value)) type = "array"
      else if (typeof value === "object") type = "object"

      fields.push({
        key,
        value,
        type,
        path,
        isEditing: false,
        originalKey: key,
      })

      // Recursively process nested objects
      if (type === "object" && value !== null) {
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          processValue(nestedKey, nestedValue, `${path}.${nestedKey}`)
        })
      }
    }

    Object.entries(obj).forEach(([key, value]) => {
      const path = parentPath ? `${parentPath}.${key}` : key
      processValue(key, value, path)
    })

    return fields
  }

  // Convert fields back to JSON
  const fieldsToJson = (fields: JsonField[]): any => {
    const result: any = {}

    fields.forEach((field) => {
      if (field.path.includes(".")) return // Skip nested fields for now

      let value = field.value

      try {
        switch (field.type) {
          case "number":
            value = Number(field.value) || 0
            break
          case "boolean":
            value = field.value === true || field.value === "true"
            break
          case "null":
            value = null
            break
          case "array":
            value = typeof field.value === "string" ? JSON.parse(field.value) : field.value
            break
          case "object":
            value = typeof field.value === "string" ? JSON.parse(field.value) : field.value
            break
          default:
            value = String(field.value)
        }
      } catch {
        value = field.value
      }

      result[field.key] = value
    })

    return result
  }

  // Start inline editing
  const startInlineEdit = (lineNumber: number, content: string) => {
    try {
      const parsed = JSON.parse(content)
      const fields = jsonToFields(parsed)
      setJsonFields(fields)
      setEditingLine(lineNumber)

      const updatedLines = parsedLines.map((line) =>
        line.lineNumber === lineNumber ? { ...line, isEditing: true, editMode: "inline" as const } : line,
      )
      setParsedLines(updatedLines)
    } catch {
      startCodeEdit(lineNumber, content)
    }
  }

  // Start code editing
  const startCodeEdit = (lineNumber: number, content: string) => {
    setEditingLine(lineNumber)
    setEditContent(content)

    const updatedLines = parsedLines.map((line) =>
      line.lineNumber === lineNumber ? { ...line, isEditing: true, editMode: "code" as const } : line,
    )
    setParsedLines(updatedLines)
  }

  // Start visual editing
  const startVisualEdit = (lineNumber: number, content: string) => {
    try {
      const parsed = JSON.parse(content)
      const fields = jsonToFields(parsed)
      setJsonFields(fields)
      setEditingLine(lineNumber)

      const updatedLines = parsedLines.map((line) =>
        line.lineNumber === lineNumber ? { ...line, isEditing: true, editMode: "visual" as const } : line,
      )
      setParsedLines(updatedLines)
    } catch {
      alert("JSON formatida xatolik bor")
    }
  }

  // Update field value
  const updateFieldValue = (path: string, newValue: any, newType?: JsonField["type"]) => {
    const updatedFields = jsonFields.map((field) =>
      field.path === path ? { ...field, value: newValue, type: newType || field.type } : field,
    )
    setJsonFields(updatedFields)

    if (autoSave) {
      saveInlineEdit()
    }
  }

  // Add new field
  const addNewField = () => {
    const newField: JsonField = {
      key: "",
      value: "",
      type: "string",
      path: `new_field_${Date.now()}`,
      isEditing: true,
    }
    setJsonFields([...jsonFields, newField])
  }

  // Remove field
  const removeField = (path: string) => {
    setJsonFields(jsonFields.filter((field) => field.path !== path))
  }

  // Save inline edit
  const saveInlineEdit = () => {
    if (editingLine === null) return

    try {
      const jsonObj = fieldsToJson(jsonFields)
      const jsonString = JSON.stringify(jsonObj)

      const updatedLines = parsedLines.map((line) => {
        if (line.lineNumber === editingLine) {
          return {
            ...line,
            content: jsonString,
            parsed: jsonObj,
            isValid: true,
            error: undefined,
            isEditing: false,
            editMode: undefined,
          }
        }
        return line
      })

      setParsedLines(updatedLines)
      setEditingLine(null)
      setJsonFields([])
      setHasUnsavedChanges(true)
      validateContent(updatedLines)
    } catch (error) {
      alert(`Xatolik: ${error instanceof Error ? error.message : "Noma'lum xatolik"}`)
    }
  }

  // Save code edit
  const saveCodeEdit = () => {
    if (editingLine === null) return

    try {
      const parsed = JSON.parse(editContent)

      const updatedLines = parsedLines.map((line) => {
        if (line.lineNumber === editingLine) {
          return {
            ...line,
            content: editContent,
            parsed,
            isValid: true,
            error: undefined,
            isEditing: false,
            editMode: undefined,
          }
        }
        return line
      })

      setParsedLines(updatedLines)
      setEditingLine(null)
      setEditContent("")
      setHasUnsavedChanges(true)
      validateContent(updatedLines)
    } catch (error) {
      alert(`Noto'g'ri JSON: ${error instanceof Error ? error.message : "Noma'lum xatolik"}`)
    }
  }

  // Cancel edit
  const cancelEdit = () => {
    const updatedLines = parsedLines.map((line) =>
      line.lineNumber === editingLine ? { ...line, isEditing: false, editMode: undefined } : line,
    )
    setParsedLines(updatedLines)

    setEditingLine(null)
    setEditContent("")
    setJsonFields([])
    setEditingField(null)
  }

  // Format JSON
  const formatJson = (lineNumber: number) => {
    const line = parsedLines.find((l) => l.lineNumber === lineNumber)
    if (!line || !line.isValid) return

    try {
      const formatted = JSON.stringify(line.parsed, null, 2).replace(/\n/g, "").replace(/\s+/g, " ")

      const updatedLines = parsedLines.map((l) => (l.lineNumber === lineNumber ? { ...l, content: formatted } : l))

      setParsedLines(updatedLines)
      setHasUnsavedChanges(true)
    } catch (error) {
      console.error("Format error:", error)
    }
  }

  // Duplicate line
  const duplicateLine = (lineNumber: number) => {
    const line = parsedLines.find((l) => l.lineNumber === lineNumber)
    if (!line) return

    const newLine: ParsedLine = {
      ...line,
      lineNumber: lineNumber + 1,
      isEditing: false,
    }

    const updatedLines = [...parsedLines]
    updatedLines.splice(lineNumber, 0, newLine)

    const renumberedLines = updatedLines.map((l, index) => ({
      ...l,
      lineNumber: index + 1,
    }))

    setParsedLines(renumberedLines)
    setHasUnsavedChanges(true)
    validateContent(renumberedLines)
  }

  // Validate JSONL content
  const validateContent = (lines: ParsedLine[]) => {
    const errors: Array<{ line: number; error: string }> = []
    const warnings: Array<{ line: number; warning: string }> = []
    let validLines = 0

    lines.forEach((line) => {
      if (line.isValid) {
        validLines++

        if (line.parsed && Object.keys(line.parsed).length === 0) {
          warnings.push({ line: line.lineNumber, warning: "Bo'sh JSON obyekt" })
        }
        if (line.content.length > 10000) {
          warnings.push({ line: line.lineNumber, warning: "Juda katta qator (>10KB)" })
        }
      } else {
        errors.push({ line: line.lineNumber, error: line.error || "Noto'g'ri JSON" })
      }
    })

    const result: ValidationResult = {
      isValid: errors.length === 0,
      totalLines: lines.length,
      validLines,
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

  // Add new line at specific position
  const addNewLineAt = (afterLineNumber: number) => {
    const template = selectedTemplate || "{}"

    try {
      const parsed = JSON.parse(template)
      const newLine: ParsedLine = {
        lineNumber: afterLineNumber + 1,
        content: template,
        parsed,
        isValid: true,
        isEditing: false,
        editMode: "visual",
      }

      const updatedLines = [...parsedLines]
      updatedLines.splice(afterLineNumber, 0, newLine)

      const renumberedLines = updatedLines.map((line, index) => ({
        ...line,
        lineNumber: index + 1,
      }))

      setParsedLines(renumberedLines)
      setHasUnsavedChanges(true)
      validateContent(renumberedLines)

      // Start editing the new line
      startInlineEdit(afterLineNumber + 1, template)
    } catch {
      alert("Template da xatolik bor")
    }
  }

  // Add new line at end
  const addNewLine = () => {
    addNewLineAt(parsedLines.length)
  }

  // Delete line
  const deleteLine = (lineNumber: number) => {
    const updatedLines = parsedLines.filter((line) => line.lineNumber !== lineNumber)
    const renumberedLines = updatedLines.map((line, index) => ({
      ...line,
      lineNumber: index + 1,
    }))
    setParsedLines(renumberedLines)
    setHasUnsavedChanges(true)
    validateContent(renumberedLines)
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

  // Download edited file
  const downloadFile = () => {
    const content = parsedLines.map((line) => line.content).join("\n")
    const blob = new Blob([content], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileInfo?.name || "edited.jsonl"
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

  // Filter and search
  const filteredLines = parsedLines.filter((line) => {
    if (filterType === "valid" && !line.isValid) return false
    if (filterType === "invalid" && line.isValid) return false

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      return (
        line.content.toLowerCase().includes(searchLower) ||
        (line.error && line.error.toLowerCase().includes(searchLower))
      )
    }

    return true
  })

  // Toggle line expansion
  const toggleLineExpansion = (lineNumber: number) => {
    const newExpanded = new Set(expandedLines)
    if (newExpanded.has(lineNumber)) {
      newExpanded.delete(lineNumber)
    } else {
      newExpanded.add(lineNumber)
    }
    setExpandedLines(newExpanded)
  }

  // Get field type icon
  const getFieldTypeIcon = (type: JsonField["type"]) => {
    switch (type) {
      case "string":
        return Quote
      case "number":
        return Hash
      case "boolean":
        return ToggleLeft
      case "array":
        return Brackets
      case "object":
        return Braces
      case "null":
        return X
      default:
        return Type
    }
  }

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
              <FileJson className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Professional JSONL Editor</h1>
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}>
                    <Keyboard className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Klaviatura yorliqlari</TooltipContent>
              </Tooltip>
            </TooltipProvider>

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

        {/* Keyboard Shortcuts Panel */}
        {showKeyboardShortcuts && (
          <div className="border-t bg-muted/50 p-4">
            <div className="container mx-auto">
              <h3 className="font-medium mb-2">Klaviatura Yorliqlari:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <kbd className="px-2 py-1 bg-background rounded">Ctrl+S</kbd> Saqlash
                </div>
                <div>
                  <kbd className="px-2 py-1 bg-background rounded">Ctrl+N</kbd> Yangi qator
                </div>
                <div>
                  <kbd className="px-2 py-1 bg-background rounded">Ctrl+F</kbd> Qidirish
                </div>
                <div>
                  <kbd className="px-2 py-1 bg-background rounded">Esc</kbd> Bekor qilish
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* File Upload Area */}
        {!fileInfo && (
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
                <h3 className="text-lg font-semibold mb-2">JSONL Fayl Yuklash</h3>
                <p className="text-muted-foreground mb-4">
                  JSONL faylingizni bu yerga sudrab tashlang yoki tanlash uchun bosing
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>Fayl Tanlash</Button>
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

        {/* Main Content */}
        {fileInfo && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Controls */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg">Professional Boshqaruv</CardTitle>
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

                  {/* Template Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Professional Shablonlar</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {JSON_TEMPLATES.map((template) => {
                        const IconComponent = template.icon
                        return (
                          <Button
                            key={template.name}
                            variant={selectedTemplate === template.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTemplate(template.value)}
                            className="h-auto p-2 flex flex-col items-center gap-1"
                          >
                            <IconComponent className="w-4 h-4" />
                            <span className="text-xs">{template.name}</span>
                          </Button>
                        )
                      })}
                    </div>
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
                      value={filterType}
                      onValueChange={(value: "all" | "valid" | "invalid") => setFilterType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Barcha Qatorlar</SelectItem>
                        <SelectItem value="valid">Faqat To'g'ri</SelectItem>
                        <SelectItem value="invalid">Faqat Xato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* View Options */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Ko'rinish Sozlamalari</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Qator Raqamlari</Label>
                        <Switch checked={showLineNumbers} onCheckedChange={setShowLineNumbers} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Xom Matn</Label>
                        <Switch checked={showRawContent} onCheckedChange={setShowRawContent} />
                      </div>
                    </div>
                  </div>

                  {/* Add New Line */}
                  <Button onClick={addNewLine} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Yangi Qator (Ctrl+N)
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
                            {validationResult.isValid ? "✅ To'g'ri JSONL" : "❌ Xato JSONL"}
                          </div>
                          <div className="text-xs space-y-1">
                            <div>Jami: {validationResult.totalLines}</div>
                            <div>To'g'ri: {validationResult.validLines}</div>
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
                      <FileText className="w-5 h-5" />
                      Professional JSON Editor
                      <Badge variant="outline">
                        {filteredLines.length} / {parsedLines.length} qator
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(parsedLines.map((line) => line.content).join("\n"))}
                            >
                              {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Barcha mazmunni nusxalash</TooltipContent>
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
                        <p className="text-muted-foreground">Professional qayta ishlash...</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-2">
                        {filteredLines.map((line, index) => (
                          <div key={line.lineNumber}>
                            <Card
                              className={`${!line.isValid ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""} ${line.isEditing ? "ring-2 ring-primary" : ""}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  {/* Line Number */}
                                  {showLineNumbers && (
                                    <div className="flex-shrink-0">
                                      <Badge variant="outline" className="font-mono text-xs">
                                        {line.lineNumber}
                                      </Badge>
                                    </div>
                                  )}

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    {line.isEditing ? (
                                      // Edit Mode
                                      <div className="space-y-3">
                                        {line.editMode === "inline" && (
                                          // Inline Editing Mode
                                          <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
                                            <div className="flex items-center justify-between">
                                              <h4 className="font-medium flex items-center gap-2">
                                                <Zap className="w-4 h-4" />
                                                Professional Inline Editor
                                              </h4>
                                              <div className="flex gap-2">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => startCodeEdit(line.lineNumber, line.content)}
                                                >
                                                  <Code className="w-4 h-4 mr-1" />
                                                  Kod
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => startVisualEdit(line.lineNumber, line.content)}
                                                >
                                                  <Settings className="w-4 h-4 mr-1" />
                                                  Vizual
                                                </Button>
                                              </div>
                                            </div>

                                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                              {jsonFields
                                                .filter((field) => !field.path.includes("."))
                                                .map((field, fieldIndex) => {
                                                  const IconComponent = getFieldTypeIcon(field.type)
                                                  return (
                                                    <div
                                                      key={field.path}
                                                      className="flex gap-2 items-center p-2 bg-background rounded border"
                                                    >
                                                      <IconComponent className="w-4 h-4 text-muted-foreground" />

                                                      {/* Key Input */}
                                                      <Input
                                                        placeholder="Kalit nomi"
                                                        value={field.key}
                                                        onChange={(e) => {
                                                          const updatedFields = [...jsonFields]
                                                          updatedFields[fieldIndex] = { ...field, key: e.target.value }
                                                          setJsonFields(updatedFields)
                                                        }}
                                                        className="flex-1 h-8"
                                                        list={`keys-${fieldIndex}`}
                                                      />
                                                      <datalist id={`keys-${fieldIndex}`}>
                                                        {COMMON_KEYS.map((key) => (
                                                          <option key={key} value={key} />
                                                        ))}
                                                      </datalist>

                                                      {/* Type Selector */}
                                                      <Select
                                                        value={field.type}
                                                        onValueChange={(value: JsonField["type"]) =>
                                                          updateFieldValue(field.path, field.value, value)
                                                        }
                                                      >
                                                        <SelectTrigger className="w-20 h-8">
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="string">Matn</SelectItem>
                                                          <SelectItem value="number">Raqam</SelectItem>
                                                          <SelectItem value="boolean">Bool</SelectItem>
                                                          <SelectItem value="array">Array</SelectItem>
                                                          <SelectItem value="object">Object</SelectItem>
                                                          <SelectItem value="null">Null</SelectItem>
                                                        </SelectContent>
                                                      </Select>

                                                      {/* Value Input */}
                                                      {field.type === "boolean" ? (
                                                        <Switch
                                                          checked={field.value === true || field.value === "true"}
                                                          onCheckedChange={(checked) =>
                                                            updateFieldValue(field.path, checked)
                                                          }
                                                        />
                                                      ) : (
                                                        <Input
                                                          placeholder="Qiymat"
                                                          value={String(field.value)}
                                                          onChange={(e) => updateFieldValue(field.path, e.target.value)}
                                                          className="flex-1 h-8"
                                                          type={field.type === "number" ? "number" : "text"}
                                                        />
                                                      )}

                                                      {/* Remove Field */}
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => removeField(field.path)}
                                                        className="h-8 w-8 p-0"
                                                      >
                                                        <X className="w-4 h-4" />
                                                      </Button>
                                                    </div>
                                                  )
                                                })}
                                            </div>

                                            <div className="flex gap-2">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={addNewField}
                                                className="flex-1 bg-transparent"
                                              >
                                                <Plus className="w-4 h-4 mr-1" />
                                                Yangi Maydon
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => formatJson(line.lineNumber)}
                                              >
                                                <Wand2 className="w-4 h-4 mr-1" />
                                                Format
                                              </Button>
                                            </div>
                                          </div>
                                        )}

                                        {line.editMode === "visual" && (
                                          // Visual Editor (same as inline but different styling)
                                          <div className="space-y-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                                            <div className="flex items-center justify-between">
                                              <h4 className="font-medium">Vizual JSON Editor</h4>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => startCodeEdit(line.lineNumber, line.content)}
                                              >
                                                <Code className="w-4 h-4 mr-1" />
                                                Kod Rejimi
                                              </Button>
                                            </div>
                                            {/* Same content as inline editor */}
                                          </div>
                                        )}

                                        {line.editMode === "code" && (
                                          // Code Editor
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <h4 className="font-medium flex items-center gap-2">
                                                <Code className="w-4 h-4" />
                                                Kod Editor
                                              </h4>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  try {
                                                    const parsed = JSON.parse(editContent)
                                                    startInlineEdit(line.lineNumber, editContent)
                                                  } catch {
                                                    alert("JSON formatida xatolik bor")
                                                  }
                                                }}
                                              >
                                                <Zap className="w-4 h-4 mr-1" />
                                                Inline Rejim
                                              </Button>
                                            </div>
                                            <Textarea
                                              value={editContent}
                                              onChange={(e) => setEditContent(e.target.value)}
                                              className="font-mono text-sm min-h-[120px]"
                                              placeholder="JSON kodini bu yerga yozing..."
                                            />
                                          </div>
                                        )}

                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={line.editMode === "code" ? saveCodeEdit : saveInlineEdit}
                                            className="bg-green-600 hover:bg-green-700"
                                          >
                                            <Check className="w-4 h-4 mr-1" />
                                            Saqlash
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                                            <X className="w-4 h-4 mr-1" />
                                            Bekor Qilish (Esc)
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      // View Mode
                                      <div>
                                        {line.isValid ? (
                                          <Collapsible
                                            open={expandedLines.has(line.lineNumber)}
                                            onOpenChange={() => toggleLineExpansion(line.lineNumber)}
                                          >
                                            <CollapsibleTrigger className="flex items-center gap-2 hover:bg-muted/50 p-2 rounded w-full text-left">
                                              {expandedLines.has(line.lineNumber) ? (
                                                <ChevronDown className="w-4 h-4" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4" />
                                              )}
                                              <span className="text-sm text-muted-foreground">
                                                {Object.keys(line.parsed || {})
                                                  .slice(0, 3)
                                                  .join(", ")}
                                                {Object.keys(line.parsed || {}).length > 3 && "..."}
                                              </span>
                                              <Badge variant="secondary" className="ml-auto">
                                                {Object.keys(line.parsed || {}).length} kalit
                                              </Badge>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                              <div className="mt-2 p-3 bg-muted/50 rounded">
                                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                                  {showRawContent ? line.content : JSON.stringify(line.parsed, null, 2)}
                                                </pre>
                                              </div>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ) : (
                                          // Invalid JSON
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <AlertTriangle className="w-4 h-4 text-red-500" />
                                              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                                                Noto'g'ri JSON
                                              </span>
                                            </div>
                                            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200">
                                              <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                                                {line.error}
                                              </p>
                                              <pre className="text-xs font-mono text-red-700 dark:text-red-300 overflow-x-auto">
                                                {line.content}
                                              </pre>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Professional Actions */}
                                  <div className="flex-shrink-0 flex flex-col gap-1">
                                    <div className="flex gap-1">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => copyToClipboard(line.content)}
                                              className="h-8 w-8 p-0"
                                            >
                                              {copiedText === line.content ? (
                                                <Check className="w-3 h-3" />
                                              ) : (
                                                <Copy className="w-3 h-3" />
                                              )}
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Nusxalash</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => startInlineEdit(line.lineNumber, line.content)}
                                              className="h-8 w-8 p-0"
                                            >
                                              <Zap className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Inline tahrirlash</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>

                                    <div className="flex gap-1">
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => duplicateLine(line.lineNumber)}
                                              className="h-8 w-8 p-0"
                                            >
                                              <Copy className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Nusxa yaratish</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>

                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => deleteLine(line.lineNumber)}
                                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>O'chirish</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Add line button between rows */}
                            <div className="flex justify-center py-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addNewLineAt(line.lineNumber)}
                                      className="h-6 w-6 p-0 rounded-full opacity-0 hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20"
                                    >
                                      <PlusCircle className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Bu yerga yangi qator qo'shish</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        ))}

                        {filteredLines.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Qidiruv mezonlariga mos qator topilmadi</p>
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
