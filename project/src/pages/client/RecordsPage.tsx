import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadFile, STORAGE_BUCKETS, generateFilePath, MAX_FILE_SIZE } from '../../lib/storage';
import toast from 'react-hot-toast';

interface Record {
  id: string;
  invoice_file_url: string;
  verification_file_url: string | null;
  created_at: string;
}

interface UploadError {
  code: string;
  stage: string;
  details: {
    fileType: string;
    fileSize: number;
    fileName: string;
    timestamp: string;
    bucket: string;
  };
}

export default function RecordsPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const verificationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('client_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecords(data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (
    file: File,
    type: 'invoice' | 'verification'
  ) => {
    try {
      setUploading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds maximum limit of 50MB');
      }

      // Validate file type
      const allowedTypes = type === 'invoice' 
        ? ['.pdf', '.docx', '.xlsx']
        : ['.png', '.jpg', '.jpeg', '.pdf'];
      
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!allowedTypes.includes(fileExtension)) {
        throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      }

      // Generate unique file path
      const filePath = generateFilePath(user.id, file.name);

      // Upload file to storage
      const { url: fileUrl } = await uploadFile(
        STORAGE_BUCKETS.CLIENT_RECORDS,
        file,
        filePath
      );
      
      // Create or update record in database
      const recordData = type === 'invoice'
        ? { invoice_file_url: fileUrl, user_id: user.id }
        : { verification_file_url: fileUrl };

      if (type === 'invoice') {
        const { error: insertError } = await supabase
          .from('client_records')
          .insert([recordData]);

        if (insertError) throw insertError;
      } else {
        // For verification, update the latest record without verification
        const { data: latestRecord } = await supabase
          .from('client_records')
          .select('id')
          .is('verification_file_url', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestRecord) {
          const { error: updateError } = await supabase
            .from('client_records')
            .update(recordData)
            .eq('id', latestRecord.id);

          if (updateError) throw updateError;
        }
      }

      toast.success(`${type === 'invoice' ? 'Invoice' : 'Verification'} file uploaded successfully`);
      fetchRecords();

      // Reset file input
      if (type === 'invoice' && invoiceInputRef.current) {
        invoiceInputRef.current.value = '';
      } else if (type === 'verification' && verificationInputRef.current) {
        verificationInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload error:', {
        error: err,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
        uploadType: type,
        timestamp: new Date().toISOString(),
      });

      // Handle specific upload errors
      if ((err as UploadError).code) {
        const uploadError = err as UploadError;
        const errorMessage = `Upload failed during ${uploadError.stage} stage: ${uploadError.message}`;
        toast.error(errorMessage);
        setError(errorMessage);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload file';
        toast.error(errorMessage);
        setError(errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Instructions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Instructions</h2>
        <div className="prose text-gray-600">
          <p>Please follow these guidelines when uploading your records:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Upload invoice files (proof of transaction) under Invoice Upload</li>
            <li>Upload verification files (proof of payment) under Verification Upload</li>
            <li>Accepted formats for invoices: PDF, DOCX, XLSX</li>
            <li>Accepted formats for verification: PNG, JPG, PDF</li>
            <li>Maximum file size: 50MB</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-700 mb-2">
            <AlertCircle className="h-5 w-5 mr-2" />
            <h3 className="font-medium">Upload Error</h3>
          </div>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Upload Sections */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Invoice Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Upload</h3>
          <div className="relative">
            <input
              ref={invoiceInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'invoice');
              }}
              className="hidden"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => invoiceInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 transition-colors duration-200"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-gray-600">Upload Invoice</span>
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Verification Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Upload</h3>
          <div className="relative">
            <input
              ref={verificationInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'verification');
              }}
              className="hidden"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => verificationInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 transition-colors duration-200"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-gray-600">Upload Verification</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Past Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verification
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(record.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a
                      href={record.invoice_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-indigo-600 hover:text-indigo-900"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      <span>View Invoice</span>
                      <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.verification_file_url ? (
                      <a
                        href={record.verification_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-indigo-600 hover:text-indigo-900"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        <span>View Verification</span>
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    ) : (
                      <span className="text-gray-400">Not uploaded</span>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    No records found. Upload your first invoice to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}