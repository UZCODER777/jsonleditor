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

  // Edit line functionality
  const startEditing = (lineNumber: number, content: string) => {
    setEditingLine(lineNumber)
    setEditContent(content)
  }

  const saveEdit = () => {
    if (editingLine === null) return

    try {
      // Validate the edited JSON
      JSON.parse(editContent)

      // Update the line
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
      alert(`Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const cancelEdit = () => {
    setEditingLine(null)
    setEditContent("")
  }

  // Delete line
  const deleteLine = (lineNumber: number) => {
    const updatedLines = parsedLines.filter((line) => line.lineNumber !== lineNumber)
    // Renumber lines
    const renumberedLines = updatedLines.map((line, index) => ({
      ...line,
      lineNumber: index + 1,
    }))
    setParsedLines(renumberedLines)
    setHasUnsavedChanges(true)
    validateContent(renumberedLines)
  }

  // Add new line
  const addNewLine = () => {
    const newLine: ParsedLine = {
      lineNumber: parsedLines.length + 1,
      content: "{}",
      parsed: {},
      isValid: true,
      isEditing: true,
    }
    setParsedLines([...parsedLines, newLine])
    setEditingLine(newLine.lineNumber)
    setEditContent("{}")
    setHasUnsavedChanges(true)
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
    // Apply filter
    if (filterType === "valid" && !line.isValid) return false
    if (filterType === "invalid" && line.isValid) return false

    // Apply search
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
                  {hasUnsavedChanges && <span className="text-orange-500 ml-2">• Unsaved changes</span>}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                <h3 className="text-lg font-semibold mb-2">Upload JSONL File</h3>
                <p className="text-muted-foreground mb-4">Drag and drop your .jsonl file here, or click to browse</p>
                <Button onClick={() => fileInputRef.current?.click()}>Choose File</Button>
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
                  <CardTitle className="text-lg">Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* File Actions */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">File Actions</Label>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="justify-start"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload New
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadFile}
                        disabled={!hasUnsavedChanges}
                        className="justify-start bg-transparent"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetToOriginal}
                        disabled={!hasUnsavedChanges}
                        className="justify-start bg-transparent"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Search & Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Search & Filter</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search lines..."
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
                        <SelectItem value="all">All Lines</SelectItem>
                        <SelectItem value="valid">Valid Only</SelectItem>
                        <SelectItem value="invalid">Invalid Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* View Options */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">View Options</Label>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="line-numbers" className="text-sm">
                        Line Numbers
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowLineNumbers(!showLineNumbers)}>
                        {showLineNumbers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="raw-content" className="text-sm">
                        Raw Content
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowRawContent(!showRawContent)}>
                        {showRawContent ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Add New Line */}
                  <Button onClick={addNewLine} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line
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
                            {validationResult.isValid ? "✅ Valid JSONL" : "❌ Invalid JSONL"}
                          </div>
                          <div className="text-xs space-y-1">
                            <div>Total: {validationResult.totalLines}</div>
                            <div>Valid: {validationResult.validLines}</div>
                            <div>Errors: {validationResult.errors.length}</div>
                            <div>Warnings: {validationResult.warnings.length}</div>
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
                      JSONL Content
                      <Badge variant="outline">
                        {filteredLines.length} / {parsedLines.length} lines
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
                          <TooltipContent>Copy all content</TooltipContent>
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
                        <p className="text-muted-foreground">Processing file...</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-2">
                        {filteredLines.map((line) => (
                          <Card
                            key={line.lineNumber}
                            className={`${!line.isValid ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}`}
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
                                  {editingLine === line.lineNumber ? (
                                    // Edit Mode
                                    <div className="space-y-2">
                                      <Textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="font-mono text-sm"
                                        rows={3}
                                      />
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={saveEdit}>
                                          <Check className="w-4 h-4 mr-1" />
                                          Save
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                                          <X className="w-4 h-4 mr-1" />
                                          Cancel
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
                                              {Object.keys(line.parsed || {}).length} keys
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
                                              Invalid JSON
                                            </span>
                                          </div>
                                          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200">
                                            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{line.error}</p>
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
                                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(line.content)}>
                                          {copiedText === line.content ? (
                                            <Check className="w-3 h-3" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Copy line</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditing(line.lineNumber, line.content)}
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit line</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" onClick={() => deleteLine(line.lineNumber)}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete line</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        {filteredLines.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No lines match your search criteria</p>
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
