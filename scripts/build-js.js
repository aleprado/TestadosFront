#!/usr/bin/env node

/**
 * 🔒 SCRIPT DE OFUSCACIÓN Y MINIFICACIÓN DE JAVASCRIPT
 * Este script ofusca y minifica todo el código JavaScript para producción
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const Terser = require('terser');

// Configuración de ofuscación
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// Configuración de minificación
const minificationOptions = {
    compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
    },
    mangle: {
        toplevel: true,
        eval: true
    },
    output: {
        comments: false
    }
};

// Función para ofuscar un archivo JavaScript
async function obfuscateFile(inputPath, outputPath) {
    try {
        console.log(`🔒 Ofuscando: ${inputPath}`);
        
        // Leer el archivo
        const code = fs.readFileSync(inputPath, 'utf8');
        
        // Primero minificar
        const minifiedResult = await Terser.minify(code, minificationOptions);
        if (minifiedResult.error) {
            throw new Error(`Error en minificación: ${minifiedResult.error.message}`);
        }
        
        // Luego ofuscar
        const obfuscationResult = JavaScriptObfuscator.obfuscate(
            minifiedResult.code,
            obfuscationOptions
        );
        
        // Crear directorio de salida si no existe
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Escribir archivo ofuscado
        fs.writeFileSync(outputPath, obfuscationResult.getObfuscatedCode());
        
        // Calcular estadísticas
        const originalSize = Buffer.byteLength(code, 'utf8');
        const obfuscatedSize = Buffer.byteLength(obfuscationResult.getObfuscatedCode(), 'utf8');
        const compressionRatio = ((originalSize - obfuscatedSize) / originalSize * 100).toFixed(2);
        
        console.log(`✅ Ofuscado: ${outputPath}`);
        console.log(`   📊 Tamaño original: ${(originalSize / 1024).toFixed(2)} KB`);
        console.log(`   📊 Tamaño ofuscado: ${(obfuscatedSize / 1024).toFixed(2)} KB`);
        console.log(`   📊 Compresión: ${compressionRatio}%`);
        
        return {
            success: true,
            originalSize,
            obfuscatedSize,
            compressionRatio
        };
        
    } catch (error) {
        console.error(`❌ Error ofuscando ${inputPath}:`, error.message);
        return { success: false, error: error.message };
    }
}

// Función para procesar todos los archivos JavaScript
async function processAllJavaScript() {
    console.log('🚀 Iniciando proceso de ofuscación de JavaScript...\n');
    
    const srcDir = path.join(__dirname, '..', 'src', 'frontend');
    const distDir = path.join(__dirname, '..', 'dist', 'frontend');
    
    // Crear directorio de distribución si no existe
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Copiar estructura de directorios
    function copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const items = fs.readdirSync(src);
        items.forEach(item => {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            
            if (fs.statSync(srcPath).isDirectory()) {
                copyDirectory(srcPath, destPath);
            } else if (item.endsWith('.js')) {
                // Procesar archivos JavaScript
                obfuscateFile(srcPath, destPath);
            } else {
                // Copiar otros archivos sin modificar
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }
    
    // Procesar archivos JavaScript
    const jsFiles = [];
    function findJsFiles(dir, baseDir = srcDir) {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                findJsFiles(fullPath, baseDir);
            } else if (item.endsWith('.js')) {
                jsFiles.push({
                    input: fullPath,
                    output: fullPath.replace(srcDir, distDir)
                });
            }
        });
    }
    
    findJsFiles(srcDir);
    
    console.log(`📁 Encontrados ${jsFiles.length} archivos JavaScript para procesar\n`);
    
    // Procesar cada archivo
    const results = [];
    for (const file of jsFiles) {
        const result = await obfuscateFile(file.input, file.output);
        results.push({ file: file.input, ...result });
    }
    
    // Copiar otros archivos
    console.log('\n📋 Copiando archivos no-JavaScript...');
    copyDirectory(srcDir, distDir);
    
    // Resumen final
    console.log('\n🎉 Proceso de ofuscación completado!');
    console.log('=' * 50);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Archivos procesados exitosamente: ${successful}`);
    if (failed > 0) {
        console.log(`❌ Archivos con errores: ${failed}`);
    }
    
    if (successful > 0) {
        const totalOriginal = results.filter(r => r.success).reduce((sum, r) => sum + r.originalSize, 0);
        const totalObfuscated = results.filter(r => r.success).reduce((sum, r) => sum + r.obfuscatedSize, 0);
        const avgCompression = ((totalOriginal - totalObfuscated) / totalOriginal * 100).toFixed(2);
        
        console.log(`📊 Tamaño total original: ${(totalOriginal / 1024).toFixed(2)} KB`);
        console.log(`📊 Tamaño total ofuscado: ${(totalObfuscated / 1024).toFixed(2)} KB`);
        console.log(`📊 Compresión promedio: ${avgCompression}%`);
    }
    
    console.log(`\n📁 Archivos ofuscados disponibles en: ${distDir}`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
    processAllJavaScript().catch(console.error);
}

module.exports = { obfuscateFile, processAllJavaScript };
