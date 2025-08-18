#!/usr/bin/env node

/**
 * 🎨 SCRIPT DE MINIFICACIÓN DE CSS
 * Este script minifica todo el CSS para producción
 */

const fs = require('fs');
const path = require('path');

// Función para minificar CSS básico
function minifyCSS(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remover comentarios
        .replace(/\s+/g, ' ') // Remover espacios múltiples
        .replace(/\s*{\s*/g, '{') // Remover espacios alrededor de {
        .replace(/\s*}\s*/g, '}') // Remover espacios alrededor de }
        .replace(/\s*:\s*/g, ':') // Remover espacios alrededor de :
        .replace(/\s*;\s*/g, ';') // Remover espacios alrededor de ;
        .replace(/\s*,\s*/g, ',') // Remover espacios alrededor de ,
        .replace(/;\s*}/g, '}') // Remover ; antes de }
        .trim();
}

// Función para procesar archivos CSS
async function processCSS() {
    console.log('🎨 Iniciando minificación de CSS...\n');
    
    const srcDir = path.join(__dirname, '..', 'src', 'frontend');
    const distDir = path.join(__dirname, '..', 'dist', 'frontend');
    
    // Crear directorio de distribución si no existe
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Encontrar archivos CSS
    const cssFiles = [];
    function findCSSFiles(dir, baseDir = srcDir) {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                findCSSFiles(fullPath, baseDir);
            } else if (item.endsWith('.css')) {
                cssFiles.push({
                    input: fullPath,
                    output: fullPath.replace(srcDir, distDir)
                });
            }
        });
    }
    
    findCSSFiles(srcDir);
    
    console.log(`📁 Encontrados ${cssFiles.length} archivos CSS para procesar\n`);
    
    // Procesar cada archivo CSS
    for (const file of cssFiles) {
        try {
            console.log(`🎨 Minificando: ${file.input}`);
            
            const css = fs.readFileSync(file.input, 'utf8');
            const minifiedCSS = minifyCSS(css);
            
            // Crear directorio de salida si no existe
            const outputDir = path.dirname(file.output);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // Escribir archivo minificado
            fs.writeFileSync(file.output, minifiedCSS);
            
            // Calcular estadísticas
            const originalSize = Buffer.byteLength(css, 'utf8');
            const minifiedSize = Buffer.byteLength(minifiedCSS, 'utf8');
            const compressionRatio = ((originalSize - minifiedSize) / originalSize * 100).toFixed(2);
            
            console.log(`✅ Minificado: ${file.output}`);
            console.log(`   📊 Tamaño original: ${(originalSize / 1024).toFixed(2)} KB`);
            console.log(`   📊 Tamaño minificado: ${(minifiedSize / 1024).toFixed(2)} KB`);
            console.log(`   📊 Compresión: ${compressionRatio}%`);
            
        } catch (error) {
            console.error(`❌ Error minificando ${file.input}:`, error.message);
        }
    }
    
    console.log('\n🎉 Minificación de CSS completada!');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    processCSS().catch(console.error);
}

module.exports = { processCSS };
