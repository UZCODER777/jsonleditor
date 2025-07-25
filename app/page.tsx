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
  Download,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Search,
  Eye,
  EyeOff,
  RotateCcw,
  FileJson,
  AlertTriangle,
  Save,
  PlusCircle,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ParsedLine {
  lineNumber: number
  content: string
  parsed?: any
  error?: string
  isValid: boolean
  isEditing?: boolean
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

interface KeyValuePair {
  key: string
  value: string
  type: "string" | "number" | "boolean" | "object" | "array"
}

const JSON_TEMPLATES = [
  { name: "Bo'sh obyekt", value: "{}" },
  { name: "Foydalanuvchi", value: '{"id": 1, "name": "", "email": ""}' },
  { name: "Mahsulot", value: '{"id": 1, "name": "", "price": 0, "category": ""}' },
  { name: "Xabar", value: '{"message": "", "timestamp": "", "user": ""}' },
  { name: "Maqola", value: '{"title": "", "content": "", "author": "", "date": ""}' },
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
  const [showJsonEditor, setShowJsonEditor] = useState(false)
  const [keyValuePairs, setKeyValuePairs] = useState<KeyValuePair[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Parse JSONL content
  const parseJSONL = useCallback((content: string) => {
    setIsProcessing(true)
    const lines = content.split("\n")
    const parsed: ParsedLine[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (trimmedLine === "") return // Skip empty lines

      try {
        const parsedData = JSON.parse(trimmedLine)
        parsed.push({
          lineNumber: index + 1,
          content: trimmedLine,
          parsed: parsedData,
          isValid: true,
          isEditing: false,
        })
      } catch (error) {
        parsed.push({
          lineNumber: index + 1,
          content: trimmedLine,
          error: error instanceof Error ? error.message : "Invalid JSON",
          isValid: false,
          isEditing: false,
        })
      }
    })

    setParsedLines(parsed)
    setIsProcessing(false)
    validateContent(parsed)
  }, [])

  // Validate JSONL content
  const validateContent = (lines: ParsedLine[]) => {
    const errors: Array<{ line: number; error: string }> = []
    const warnings: Array<{ line: number; warning: string }> = []
    let validLines = 0

    lines.forEach((line) => {
      if (line.isValid) {
        validLines++

        // Check for warnings
        if (line.parsed && Object.keys(line.parsed).length === 0) {
          warnings.push({ line: line.lineNumber, warning: "Empty JSON object" })
        }
        if (line.content.length > 10000) {
          warnings.push({ line: line.lineNumber, warning: "Very large line (>10KB)" })
        }
      } else {
        errors.push({ line: line.lineNumber, error: line.error || "Invalid JSON" })
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
        alert("Please select a .jsonl or .json file")
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

  // Convert JSON object to key-value pairs
  const jsonToKeyValuePairs = (obj: any): KeyValuePair[] => {
    const pairs: KeyValuePair[] = []

    Object.entries(obj).forEach(([key, value]) => {
      let type: KeyValuePair["type"] = "string"
      let stringValue = String(value)

      if (typeof value === "number") {
        type = "number"
      } else if (typeof value === "boolean") {
        type = "boolean"
      } else if (Array.isArray(value)) {
        type = "array"
        stringValue = JSON.stringify(value)
      } else if (typeof value === "object" && value !== null) {
        type = "object"
        stringValue = JSON.stringify(value)
      }

      pairs.push({ key, value: stringValue, type })
    })

    return pairs
  }

  // Convert key-value pairs to JSON object
  const keyValuePairsToJson = (pairs: KeyValuePair[]): any => {
    const obj: any = {}

    pairs.forEach(({ key, value, type }) => {
      if (!key.trim()) return

      try {
        switch (type) {
          case "number":
            obj[key] = Number(value) || 0
            break
          case "boolean":
            obj[key] = value.toLowerCase() === "true"
            break
          case "array":
          case "object":
            obj[key] = JSON.parse(value)
            break
          default:
            obj[key] = value
        }
      } catch {
        obj[key] = value // Fallback to string if parsing fails
      }
    })

    return obj
  }

  // Start editing with visual editor
  const startVisualEditing = (lineNumber: number, content: string) => {
    try {
      const parsed = JSON.parse(content)
      setKeyValuePairs(jsonToKeyValuePairs(parsed))
      setEditingLine(lineNumber)
      setShowJsonEditor(true)
    } catch {
      // Fallback to text editing for invalid JSON
      startTextEditing(lineNumber, content)
    }
  }

  // Start text editing
  const startTextEditing = (lineNumber: number, content: string) => {
    setEditingLine(lineNumber)
    setEditContent(content)
    setShowJsonEditor(false)
  }

  // Save visual edit
  const saveVisualEdit = () => {
    if (editingLine === null) return

    try {
      const jsonObj = keyValuePairsToJson(keyValuePairs)
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
          }
        }
        return line
      })

      setParsedLines(updatedLines)
      setEditingLine(null)
      setShowJsonEditor(false)
      setKeyValuePairs([])
      setHasUnsavedChanges(true)
      validateContent(updatedLines)
    } catch (error) {
      alert(`Xatolik: ${error instanceof Error ? error.message : "Noma'lum xatolik"}`)
    }
  }

  // Save text edit
  const saveTextEdit = () => {
    if (editingLine === null) return

    try {
      JSON.parse(editContent)

      const updatedLines = parsedLines.map((line) => {
        if (line.lineNumber === editingLine) {
          return {
            ...line,
            content: editContent,
            parsed: JSON.parse(editContent),
            isValid: true,
            error: undefined,
            isEditing: false,
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
    setEditingLine(null)
    setEditContent("")
    setShowJsonEditor(false)
    setKeyValuePairs([])
  }

  // Add key-value pair
  const addKeyValuePair = () => {
    setKeyValuePairs([...keyValuePairs, { key: "", value: "", type: "string" }])
  }

  // Update key-value pair
  const updateKeyValuePair = (index: number, field: keyof KeyValuePair, value: string) => {
    const updated = [...keyValuePairs]
    updated[index] = { ...updated[index], [field]: value }
    setKeyValuePairs(updated)
  }

  // Remove key-value pair
  const removeKeyValuePair = (index: number) => {
    setKeyValuePairs(keyValuePairs.filter((_, i) => i !== index))
  }

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
      }

      // Insert the new line and renumber
      const updatedLines = [...parsedLines]
      updatedLines.splice(afterLineNumber, 0, newLine)

      // Renumber all lines
      const renumberedLines = updatedLines.map((line, index) => ({
        ...line,
        lineNumber: index + 1,
      }))

      setParsedLines(renumberedLines)
      setHasUnsavedChanges(true)
      validateContent(renumberedLines)

      // Start editing the new line
      startVisualEditing(afterLineNumber + 1, template)
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
              <h1 className="text-xl md:text-2xl font-bold">JSONL Viewer & Editor</h1>
              {fileInfo && (
                <p className="text-xs text-muted-foreground">
                  {fileInfo.name} • {(fileInfo.size / 1024).toFixed(1)}KB
                  {hasUnsavedChanges && <span className="text-orange-500 ml-2">• O'zgarishlar saqlanmagan</span>}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Button onClick={downloadFile} size="sm" className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Saqlash
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
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
                  <CardTitle className="text-lg">Boshqaruv</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <Label className="text-sm font-medium">Shablon Tanlash</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Shablon tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {JSON_TEMPLATES.map((template) => (
                          <SelectItem key={template.name} value={template.value}>
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
                        placeholder="Qatorlarni qidirish..."
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
                    <Label className="text-sm font-medium">Ko'rinish</Label>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="line-numbers" className="text-sm">
                        Qator Raqamlari
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowLineNumbers(!showLineNumbers)}>
                        {showLineNumbers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="raw-content" className="text-sm">
                        Xom Matn
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowRawContent(!showRawContent)}>
                        {showRawContent ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Add New Line */}
                  <Button onClick={addNewLine} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Yangi Qator Qo'shish
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
                      JSONL Mazmuni
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
                        <p className="text-muted-foreground">Fayl qayta ishlanmoqda...</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-2">
                        {filteredLines.map((line, index) => (
                          <div key={line.lineNumber}>
                            <Card className={`${!line.isValid ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}`}>
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
                                    {editingLine === line.lineNumber ? (
                                      // Edit Mode
                                      <div className="space-y-2">
                                        {showJsonEditor ? (
                                          // Visual JSON Editor
                                          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                                            <div className="flex items-center justify-between">
                                              <h4 className="font-medium">JSON Tahrirlash</h4>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setShowJsonEditor(false)}
                                              >
                                                <Settings className="w-4 h-4 mr-1" />
                                                Matn Rejimi
                                              </Button>
                                            </div>

                                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                              {keyValuePairs.map((pair, pairIndex) => (
                                                <div key={pairIndex} className="flex gap-2 items-center">
                                                  <Input
                                                    placeholder="Kalit"
                                                    value={pair.key}
                                                    onChange={(e) =>
                                                      updateKeyValuePair(pairIndex, "key", e.target.value)
                                                    }
                                                    className="flex-1"
                                                  />
                                                  <Select
                                                    value={pair.type}
                                                    onValueChange={(value: KeyValuePair["type"]) =>
                                                      updateKeyValuePair(pairIndex, "type", value)
                                                    }
                                                  >
                                                    <SelectTrigger className="w-24">
                                                      <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="string">Matn</SelectItem>
                                                      <SelectItem value="number">Raqam</SelectItem>
                                                      <SelectItem value="boolean">Boolean</SelectItem>
                                                      <SelectItem value="array">Array</SelectItem>
                                                      <SelectItem value="object">Object</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                  <Input
                                                    placeholder="Qiymat"
                                                    value={pair.value}
                                                    onChange={(e) =>
                                                      updateKeyValuePair(pairIndex, "value", e.target.value)
                                                    }
                                                    className="flex-1"
                                                  />
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeKeyValuePair(pairIndex)}
                                                  >
                                                    <X className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                              ))}
                                            </div>

                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={addKeyValuePair}
                                              className="w-full bg-transparent"
                                            >
                                              <Plus className="w-4 h-4 mr-1" />
                                              Kalit-Qiymat Qo'shish
                                            </Button>
                                          </div>
                                        ) : (
                                          // Text Editor
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <h4 className="font-medium">Matn Tahrirlash</h4>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  try {
                                                    const parsed = JSON.parse(editContent)
                                                    setKeyValuePairs(jsonToKeyValuePairs(parsed))
                                                    setShowJsonEditor(true)
                                                  } catch {
                                                    alert("JSON formatida xatolik bor")
                                                  }
                                                }}
                                              >
                                                <Settings className="w-4 h-4 mr-1" />
                                                Vizual Rejim
                                              </Button>
                                            </div>
                                            <Textarea
                                              value={editContent}
                                              onChange={(e) => setEditContent(e.target.value)}
                                              className="font-mono text-sm"
                                              rows={3}
                                            />
                                          </div>
                                        )}

                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={showJsonEditor ? saveVisualEdit : saveTextEdit}>
                                            <Check className="w-4 h-4 mr-1" />
                                            Saqlash
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                                            <X className="w-4 h-4 mr-1" />
                                            Bekor Qilish
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

                                  {/* Actions */}
                                  <div className="flex-shrink-0 flex gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(line.content)}
                                          >
                                            {copiedText === line.content ? (
                                              <Check className="w-3 h-3" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Qatorni nusxalash</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => startVisualEditing(line.lineNumber, line.content)}
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Qatorni tahrirlash</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button variant="ghost" size="sm" onClick={() => deleteLine(line.lineNumber)}>
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Qatorni o'chirish</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
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
                                      className="h-6 w-6 p-0 rounded-full opacity-0 hover:opacity-100 transition-opacity"
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
