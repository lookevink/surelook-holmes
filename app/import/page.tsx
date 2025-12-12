"use client";

import { useState } from "react";
import { importCSV, type CSVImportResult } from "../actions/import-csv";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsProcessing(true);
    setResult(null);

    try {
      // Read file content
      const content = await file.text();
      
      // Import CSV
      const importResult = await importCSV(content);
      setResult(importResult);
    } catch (error) {
      setResult({
        success: false,
        processed: 0,
        created: 0,
        skipped: 0,
        errors: [
          `Failed to process file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Import Identities from CSV
          </h1>
          <p className="text-lg text-gray-600">
            Upload a CSV file to bulk import identities with face embeddings.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">CSV Format</h2>
          <p className="text-gray-700 mb-2">
            Your CSV file should have the following headers:
          </p>
          <code className="block bg-gray-100 p-3 rounded mb-4 font-mono text-sm">
            name,linkedin_url,headshot_media_url
          </code>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              <strong>name</strong> (required): The person&apos;s name
            </p>
            <p>
              <strong>linkedin_url</strong> (optional): LinkedIn profile URL
            </p>
            <p>
              <strong>headshot_media_url</strong> (required for embedding
              generation): URL to the headshot image
            </p>
          </div>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Rows without a headshot_media_url will be
              skipped. Face embeddings are automatically generated from the
              headshot images.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <label
              htmlFor="csv-file"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select CSV File
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={isProcessing}
            />
          </div>

          <button
            type="submit"
            disabled={!file || isProcessing}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? "Processing..." : "Import CSV"}
          </button>
        </form>

        {result && (
          <div
            className={`mt-6 p-6 rounded-lg ${
              result.success
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <h3 className="text-lg font-semibold mb-4">
              {result.success ? "Import Completed" : "Import Completed with Errors"}
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Processed:</strong> {result.processed} rows
              </p>
              <p>
                <strong>Created:</strong> {result.created} identities
              </p>
              <p>
                <strong>Skipped:</strong> {result.skipped} rows
              </p>
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Errors:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index} className="text-red-700">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

