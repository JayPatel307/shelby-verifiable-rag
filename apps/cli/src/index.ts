#!/usr/bin/env node

/**
 * Shelby Verifiable RAG CLI
 * Upload folders and files to create source packs
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Load environment
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:4000';

interface UploadOptions {
  title?: string;
  summary?: string;
  tags?: string;
  ocr?: boolean;
  apiUrl?: string;
  userId?: string;
}

async function uploadDirectory(directory: string, options: UploadOptions) {
  console.log('\n📦 Shelby RAG CLI - Upload\n');

  // Validate directory
  if (!fs.existsSync(directory)) {
    console.error(`❌ Directory not found: ${directory}`);
    process.exit(1);
  }

  const stat = fs.statSync(directory);
  if (!stat.isDirectory()) {
    console.error(`❌ Not a directory: ${directory}`);
    process.exit(1);
  }

  // Generate title if not provided
  const title = options.title || path.basename(directory);
  const apiUrl = options.apiUrl || API_URL;
  const userId = options.userId || process.env.USER_ID;

  if (!userId) {
    console.error('❌ USER_ID not provided. Set via --user-id flag or USER_ID env variable.');
    process.exit(1);
  }

  console.log(`📁 Directory: ${directory}`);
  console.log(`📝 Title: ${title}`);
  console.log(`🔗 API URL: ${apiUrl}`);
  console.log(`👤 User ID: ${userId}\n`);

  // Collect files
  const files: string[] = [];
  function walk(dir: string) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  walk(directory);

  if (files.length === 0) {
    console.error('❌ No files found in directory');
    process.exit(1);
  }

  console.log(`📄 Found ${files.length} files\n`);

  // Create form data
  const form = new FormData();
  form.append('title', title);
  
  if (options.summary) {
    form.append('summary', options.summary);
  }
  
  if (options.tags) {
    form.append('tags', options.tags);
  }
  
  form.append('ocr', String(options.ocr || false));

  // Add files
  for (const file of files) {
    const relativePath = path.relative(directory, file);
    form.append('files', fs.createReadStream(file), {
      filename: relativePath,
    });
  }

  // Upload
  console.log('☁️  Uploading to API...\n');

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${apiUrl}/packs`, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
        ...form.getHeaders(),
      },
      body: form as any,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();

    console.log('✅ Upload complete!\n');
    console.log(`📦 Pack ID: ${result.pack_id}`);
    console.log(`📄 Files processed: ${result.files.length}`);
    console.log(`✓ Indexed: ${result.files.filter((f: any) => f.indexed).length}`);
    console.log(`✗ Failed: ${result.files.filter((f: any) => f.error).length}\n`);

    // Show details
    result.files.forEach((file: any) => {
      const status = file.error ? '❌' : file.indexed ? '✅' : '⏭️';
      console.log(`  ${status} ${file.path}`);
      if (file.indexed) {
        console.log(`     Chunks: ${file.chunks}, Hash: ${file.sha256.slice(0, 16)}...`);
      }
      if (file.error) {
        console.log(`     Error: ${file.error}`);
      }
    });

    console.log('\n🎉 Done!\n');
  } catch (error: any) {
    console.error(`\n❌ Upload failed: ${error.message}\n`);
    process.exit(1);
  }
}

// CLI Program
const program = new Command();

program
  .name('shelby-rag')
  .description('Shelby Verifiable RAG CLI - Upload documents to create source packs')
  .version('0.1.0');

program
  .command('upload <directory>')
  .description('Upload a directory of files to create a source pack')
  .option('-t, --title <title>', 'Pack title (defaults to directory name)')
  .option('-s, --summary <summary>', 'Pack summary/description')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--ocr', 'Enable OCR for images', false)
  .option('--api-url <url>', 'API URL', API_URL)
  .option('--user-id <id>', 'User ID for authentication', process.env.USER_ID)
  .action(uploadDirectory);

program.parse();

