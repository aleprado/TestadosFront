const campo=document.getElementById('campoMedicion')
const anterior=document.getElementById('anterior')
const siguiente=document.getElementById('siguiente')
const mensaje=document.getElementById('mensajeVolver')
const registros=Array.from({length:5},(_,i)=>({id:i,valor:null}))
let indice=0
let ultimoPendiente=0
function enfocar(){
  campo.focus()
  setTimeout(()=>campo.focus(),0)
}
campo.addEventListener('input',()=>{registros[indice].valor=campo.value})
anterior.addEventListener('click',()=>{
  if(indice>0){
    indice--
    mostrar(true)
  }
})
siguiente.addEventListener('click',()=>{
  if(indice<registros.length-1){
    indice++
    mostrar(true)
  }
})
function mostrar(desdeFlecha=false){
  const registro=registros[indice]
  campo.value=registro.valor??''
  enfocar()
  if(registro.valor===null) ultimoPendiente=indice
  if(desdeFlecha){
    mensaje.textContent='Volver al último sin medición'
    mensaje.style.display='block'
    mensaje.onclick=()=>{indice=ultimoPendiente;mostrar()}
  }
}
window.addEventListener('DOMContentLoaded',()=>{mostrar()})
