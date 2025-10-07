'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Eye, Edit, Send } from 'lucide-react';
import { apiFetch } from '@/lib/fetchClient';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: string[];
}

interface DocumentGeneratorProps {
  caseId: string;
}

export default function DocumentGenerator({ caseId }: DocumentGeneratorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<{
    documentId?: string;
    filePath?: string;
    fileFormat?: string;
    content?: any;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
  const token = localStorage.getItem('auth_token');
      const response = await apiFetch('/documents/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    const initialVars: Record<string, string> = {};
    template.variables.forEach((v) => {
      initialVars[v] = '';
    });
    setVariables(initialVars);
    setGeneratedDoc(null);
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    try {
  const token = localStorage.getItem('auth_token');
      const response = await apiFetch('/documents/generate', {
        method: 'POST',
        body: JSON.stringify({ caseId, templateId: selectedTemplate.id, variables }),
      });

      if (response.ok) {
        const data = await response.json();
        const doc = data.data || {};
        // doc contains: documentId, filePath, content, metadata
        const documentId = doc.documentId || doc.id || null;
        const fileFormat = (doc.metadata && doc.metadata.format) || doc.fileFormat || 'pdf';
        setGeneratedDoc({ documentId, filePath: doc.filePath, fileFormat, content: doc.content });

        // Fetch preview/download blob for PDFs, otherwise preview HTML via preview endpoint
        if (documentId) {
          if (fileFormat === 'pdf') {
            // fetch the binary file for preview
            const dl = await apiFetch(`/documents/${documentId}/download`);
            if (dl.ok) {
              const blob = await dl.blob();
              const url = URL.createObjectURL(blob);
              setPreviewUrl(url);
            }
          } else {
            // fetch preview HTML
            const pr = await apiFetch(`/documents/${documentId}/preview`);
            if (pr.ok) {
              const html = await pr.text();
              setGeneratedDoc((g) => ({ ...(g || {}), content: html }));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error generating document:', error);
    } finally {
      setLoading(false);
    }
  };

  const templateCategories = [
    { value: 'settlement', label: 'Settlement Agreements' },
    { value: 'motion', label: 'Court Motions' },
    { value: 'notice', label: 'Notices' },
    { value: 'contract', label: 'Contracts' },
    { value: 'affidavit', label: 'Affidavits' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Template Selection */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Templates</h3>
          
          <div className="space-y-2">
            {templateCategories.map((category) => {
              const categoryTemplates = templates.filter((t) => t.category === category.value);
              if (categoryTemplates.length === 0) return null;

              return (
                <div key={category.value} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{category.label}</h4>
                  {categoryTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Variable Editor */}
      <div className="lg:col-span-2">
        {selectedTemplate ? (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedTemplate.name}</h3>
            <p className="text-sm text-gray-600 mb-6">{selectedTemplate.description}</p>

            {!generatedDoc ? (
              <>
                <h4 className="text-sm font-medium text-gray-700 mb-4">Fill in the details:</h4>
                <div className="space-y-4 mb-6">
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                        {variable.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        value={variables[variable] || ''}
                        onChange={(e) =>
                          setVariables({ ...variables, [variable]: e.target.value })
                        }
                        placeholder={`Enter ${variable.replace(/_/g, ' ')}`}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading || Object.values(variables).some((v) => !v)}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <FileText className="w-5 h-5" />
                  <span>{loading ? 'Generating...' : 'Generate Document'}</span>
                </button>
              </>
            ) : (
              <>
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-900 font-medium">✅ Document generated successfully!</p>
                </div>

                {/* Preview */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Preview:</h4>
                  <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                    {generatedDoc?.fileFormat === 'pdf' ? (
                      previewUrl ? (
                        <div className="w-full h-[600px]">
                          <object data={previewUrl} type="application/pdf" width="100%" height="100%">
                            <p>PDF preview is not available. <a href={previewUrl} target="_blank" rel="noreferrer">Open in new tab</a></p>
                          </object>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">Preparing PDF preview...</p>
                      )
                    ) : (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: generatedDoc?.content || '' }}
                      />
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3">
                  <button
                    onClick={async () => {
                      try {
                        if (previewUrl) {
                          // use existing blob URL to trigger download
                          const a = document.createElement('a');
                          a.href = previewUrl;
                          const filename = (selectedTemplate?.name || 'document') + `.${generatedDoc?.fileFormat || 'pdf'}`;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          return;
                        }

                        // fallback: fetch download endpoint
                        if (generatedDoc?.documentId) {
                          const res = await apiFetch(`/documents/${generatedDoc.documentId}/download`);
                          if (!res.ok) throw new Error('Failed to download file');
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          const filename = (selectedTemplate?.name || 'document') + `.${generatedDoc?.fileFormat || 'pdf'}`;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          // cleanup url after short delay
                          setTimeout(() => URL.revokeObjectURL(url), 10000);
                        }
                      } catch (err) {
                        console.error('Download failed', err);
                      }
                    }}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download PDF</span>
                  </button>
                  <button className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                    <Send className="w-5 h-5" />
                    <span>Send to Parties</span>
                  </button>
                  <button
                    onClick={() => setGeneratedDoc(null)}
                    className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Template</h3>
            <p className="text-gray-500">Choose a document template from the left to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
