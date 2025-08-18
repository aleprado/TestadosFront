#!/usr/bin/env node

/**
 * 🌐 SCRIPT DE MINIFICACIÓN DE HTML
 * Este script minifica HTML y actualiza referencias a archivos ofuscados
 */

const fs = require('fs');
const path = require('path');

// Función para minificar HTML básico
function minifyHTML(html) {
    return html
        .replace(/<!--[\s\S]*?-->/g, '') // Remover comentarios HTML
        .replace(/\s+/g, ' ') // Remover espacios múltiples
        .replace(/>\s+</g, '><') // Remover espacios entre tags
        .replace(/\s*=\s*/g, '=') // Remover espacios alrededor de =
        .replace(/\s*>\s*/g, '>') // Remover espacios alrededor de >
        .replace(/\s*<\s*/g, '<') // Remover espacios alrededor de <
        .trim();
}

// Función para actualizar referencias a archivos
function updateFileReferences(html, isProduction = true) {
    if (isProduction) {
        // En producción, usar archivos de la carpeta dist
        return html
            .replace(/src="\.\.\/src\/frontend\//g, 'src="./')
            .replace(/href="\.\.\/src\/frontend\//g, 'href="./')
            .replace(/src="src\/frontend\//g, 'src="./')
            .replace(/href="src\/frontend\//g, 'href="./');
    }
    return html;
}

// Función para procesar archivos HTML
async function processHTML() {
    console.log('🌐 Iniciando procesamiento de HTML...\n');
    
    const srcDir = path.join(__dirname, '..', 'src', 'frontend');
    const distDir = path.join(__dirname, '..', 'dist', 'frontend');
    
    // Crear directorio de distribución si no existe
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Encontrar archivos HTML
    const htmlFiles = [];
    function findHTMLFiles(dir, baseDir = srcDir) {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                findHTMLFiles(fullPath, baseDir);
            } else if (item.endsWith('.html')) {
                htmlFiles.push({
                    input: fullPath,
                    output: fullPath.replace(srcDir, distDir)
                });
            }
        });
    }
    
    findHTMLFiles(srcDir);
    
    console.log(`📁 Encontrados ${htmlFiles.length} archivos HTML para procesar\n`);
    
    // Procesar cada archivo HTML
    for (const file of htmlFiles) {
        try {
            console.log(`🌐 Procesando: ${file.input}`);
            
            const html = fs.readFileSync(file.input, 'utf8');
            
            // Actualizar referencias a archivos
            const updatedHTML = updateFileReferences(html, true);
            
            // Minificar HTML
            const minifiedHTML = minifyHTML(updatedHTML);
            
            // Crear directorio de salida si no existe
            const outputDir = path.dirname(file.output);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // Escribir archivo procesado
            fs.writeFileSync(file.output, minifiedHTML);
            
            // Calcular estadísticas
            const originalSize = Buffer.byteLength(html, 'utf8');
            const processedSize = Buffer.byteLength(minifiedHTML, 'utf8');
            const compressionRatio = ((originalSize - processedSize) / originalSize * 100).toFixed(2);
            
            console.log(`✅ Procesado: ${file.output}`);
            console.log(`   📊 Tamaño original: ${(originalSize / 1024).toFixed(2)} KB`);
            console.log(`   📊 Tamaño procesado: ${(processedSize / 1024).toFixed(2)} KB`);
            console.log(`   📊 Compresión: ${compressionRatio}%`);
            
        } catch (error) {
            console.error(`❌ Error procesando ${file.input}:`, error.message);
        }
    }
    
    console.log('\n🎉 Procesamiento de HTML completado!');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    processHTML().catch(console.error);
}

module.exports = { processHTML };
