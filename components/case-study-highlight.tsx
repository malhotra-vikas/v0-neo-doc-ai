"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, RefreshCw, FileText, ShieldCheck } from "lucide-react"
import { generateCaseStudyHighlight } from "@/app/actions/generate-case-study"
import { useToast } from "@/components/ui/use-toast"

interface CaseStudyHighlightProps {
    fileId: string
    patientId: string
    highlight?: string | null
    fileName: string
}

export function CaseStudyHighlight({ fileId, patientId, highlight, fileName }: CaseStudyHighlightProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [highlightText, setHighlightText] = useState<string | null>(highlight || null)
    const { toast } = useToast()

    const handleGenerateHighlight = async () => {
        setIsGenerating(true)
        try {
            const result = await generateCaseStudyHighlight(fileId)

            if (result.success && result.highlight) {
                setHighlightText(result.highlight)
                toast({
                    title: "Case Study Highlight Generated",
                    description: "The case study highlight has been successfully generated with privacy protection.",
                    variant: "default",
                })
            } else {
                throw new Error(result.error || "Failed to generate case study highlight")
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to generate case study highlight",
                variant: "destructive",
            })
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Card className="mb-6">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        Case Study Highlight
                    </CardTitle>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <ShieldCheck className="h-4 w-4 mr-1 text-green-600" />
                        Privacy Protected
                    </div>
                </div>
                <CardDescription>AI-generated summary of the patient case and Puzzle Healthcare's intervention</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {highlightText ? (
                    <div className="prose dark:prose-invert max-w-none">
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{highlightText}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <FileText className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Case Study Highlight Yet</h3>
                        <p className="text-gray-500 mb-4 max-w-md">
                            Generate a privacy-protected AI summary based on the extracted text from "{fileName}".
                        </p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between gap-2 bg-gray-50 dark:bg-gray-900">
                <div className="text-xs text-gray-500 italic flex items-center">
                    <ShieldCheck className="h-3 w-3 mr-1 text-green-600" />
                    All personal identifiers are removed for privacy
                </div>
                <Button
                    onClick={handleGenerateHighlight}
                    disabled={isGenerating}
                    variant={highlightText ? "outline" : "default"}
                >
                    {isGenerating ? (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                        </>
                    ) : highlightText ? (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Regenerate
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Case Study
                        </>
                    )}
                </Button>
            </CardFooter>
        </Card>
    )
}
