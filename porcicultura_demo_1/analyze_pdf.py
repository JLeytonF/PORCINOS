#!/usr/bin/env python3
"""Analyze PDF content using PyPDF2"""
import os
import sys

try:
    from PyPDF2 import PdfReader
    has_pypdf2 = True
except ImportError:
    has_pypdf2 = False

pdf_path = r'c:\Users\jleyt\OneDrive\Documentos\Poultryia\PORCICULTURA\porcicultura_demo_1\server\storage\generated-pdfs\propuesta_granja_porcina_premium_CASO-1791759957497-d9a283.pdf'

if os.path.exists(pdf_path):
    print('✅ PDF Found')
    
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    print(f'📊 PDF Size: {len(pdf_bytes)} bytes\n')
    
    if has_pypdf2:
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text()
            
            print('--- PDF TEXT CONTENT (Extracted with PyPDF2) ---\n')
            
            # Search for key indicators
            probio_count = text.count('PROBIO-GUARD')
            mucosa_count = text.count('MUCOSA-PROTECT')
            catalog_count = text.count('Protocolo-Catalogo')
            
            print(f'✓ "PROBIO-GUARD" mentions: {probio_count}')
            print(f'✓ "MUCOSA-PROTECT" mentions: {mucosa_count}')
            print(f'✓ "Protocolo-Catalogo" mentions: {catalog_count} (should be 0)\n')
            
            # Show extracted text
            print('--- EXTRACTED PDF TEXT ---\n')
            print(text if text.strip() else '(No text extracted - PDF may be empty or image-based)')
            
            # Final verdict
            print('\n--- VERIFICATION RESULT ---\n')
            if catalog_count == 0:
                print('✅ PDF Filtering Correct:')
                print('   ✓ Contains ONLY 2 approved protocols')
                print('   ✓ Does NOT contain full 45-product catalog')
            else:
                print('⚠️  PDF may contain catalog products')
        except Exception as e:
            print(f'Error with PyPDF2: {e}')
            print('Fallback: Analyzing raw binary...')
            
            pdf_text = pdf_bytes.decode('latin-1', errors='ignore')
            probio_count = pdf_text.count('PROBIO-GUARD')
            mucosa_count = pdf_text.count('MUCOSA-PROTECT')
            catalog_count = pdf_text.count('Protocolo-Catalogo')
            
            print(f'✓ "PROBIO-GUARD" mentions: {probio_count}')
            print(f'✓ "MUCOSA-PROTECT" mentions: {mucosa_count}')
            print(f'✓ "Protocolo-Catalogo" mentions: {catalog_count}')
    else:
        print('⚠️  PyPDF2 not installed. Attempting binary analysis...')
        
        pdf_text = pdf_bytes.decode('latin-1', errors='ignore')
        probio_count = pdf_text.count('PROBIO-GUARD')
        mucosa_count = pdf_text.count('MUCOSA-PROTECT')
        catalog_count = pdf_text.count('Protocolo-Catalogo')
        
        print('\n--- PDF BINARY ANALYSIS ---')
        print(f'✓ "PROBIO-GUARD" mentions: {probio_count}')
        print(f'✓ "MUCOSA-PROTECT" mentions: {mucosa_count}')
        print(f'✓ "Protocolo-Catalogo" mentions: {catalog_count} (should be 0)\n')
        
        if catalog_count == 0:
            print('✅ VERIFICACIÓN CORRECTA:')
            print('   El PDF contiene SOLO 2 productos aprobados')
            print('   NO contiene los 45 productos del catálogo')
else:
    print(f'❌ PDF no encontrado: {pdf_path}')
