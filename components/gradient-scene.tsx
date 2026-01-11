"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGradientStore } from "@/lib/store"
import * as THREE from "three"
import { useDeviceOptimizations } from "@/hooks/use-device-optimizations"

// Shader code
const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uComplexity;
  uniform float uNoiseScale;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uFlowIntensity;
  uniform float uGrainAmount; // Intensity of the grain
  uniform float uGrainScale;  // Scale/size of the grain pattern
  uniform float uThresholdMin;
  uniform float uThresholdMax;

  varying vec2 vUv;

  // Constantes para otimização
  const float PI = 3.14159265359;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Curl noise for organic flow
  vec2 curl(float x, float y) {
    float eps = 0.01;
    float n1 = snoise(vec2(x + eps, y));
    float n2 = snoise(vec2(x - eps, y));
    float n3 = snoise(vec2(x, y + eps));
    float n4 = snoise(vec2(x, y - eps));
    float dy = (n1 - n2) / (2.0 * eps);
    float dx = (n3 - n4) / (2.0 * eps);
    return vec2(dy, -dx);
  }

  // Função para aplicar correção de gama
  vec3 gammaCorrect(vec3 color, float gamma) {
    return pow(color, vec3(1.0 / gamma));
  }

  // Função para aplicar vibrância às cores
  vec3 applyVibrance(vec3 color, float vibrance) {
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luminance), color, 1.0 + vibrance);
  }

  void main() {
    vec2 uv = vUv;
    float time = uTime * 0.5;

    // Criar múltiplas camadas de ruído com diferentes frequências
    float noise = 0.0;

    // Usar a complexidade para determinar quantas camadas usar
    float maxLayers = max(1.0, uComplexity * 1.5);
    float maxIterations = min(maxLayers, 10.0); // Limitar a 10 iterações para melhor desempenho

    // Optimization: Unroll the first few iterations for better performance
    // First iteration (i = 1.0)
    if (maxIterations >= 1.0) {
      float i = 1.0;
      vec2 flow = curl(uv.x * i * uNoiseScale, uv.y * i * uNoiseScale) * uFlowIntensity;
      vec2 animatedUV = uv + flow * (sin(time * i * 0.5) * 0.2);
      float layerNoise = snoise(animatedUV * i * uNoiseScale + time * i * 0.3);
      noise += layerNoise * (1.0 / i);
    }

    // Second iteration (i = 2.0)
    if (maxIterations >= 2.0) {
      float i = 2.0;
      vec2 flow = curl(uv.x * i * uNoiseScale, uv.y * i * uNoiseScale) * uFlowIntensity;
      vec2 animatedUV = uv + flow * (sin(time * i * 0.5) * 0.2);
      float layerNoise = snoise(animatedUV * i * uNoiseScale + time * i * 0.3);
      noise += layerNoise * (1.0 / i);
    }

    // Third iteration (i = 3.0)
    if (maxIterations >= 3.0) {
      float i = 3.0;
      vec2 flow = curl(uv.x * i * uNoiseScale, uv.y * i * uNoiseScale) * uFlowIntensity;
      vec2 animatedUV = uv + flow * (sin(time * i * 0.5) * 0.2);
      float layerNoise = snoise(animatedUV * i * uNoiseScale + time * i * 0.3);
      noise += layerNoise * (1.0 / i);
    }

    // Remaining iterations in a loop (if needed)
    if (maxIterations > 3.0) {
      for (float i = 4.0; i <= 10.0; i++) {
        if (i > maxIterations) break;

        vec2 flow = curl(uv.x * i * uNoiseScale, uv.y * i * uNoiseScale) * uFlowIntensity;
        vec2 animatedUV = uv + flow * (sin(time * i * 0.5) * 0.2);
        float layerNoise = snoise(animatedUV * i * uNoiseScale + time * i * 0.3);
        noise += layerNoise * (1.0 / i);
      }
    }

    // Normalizar o ruído para o intervalo 0-1
    noise = noise * 0.5 + 0.5;

    // Criar formas orgânicas aplicando limiar ajustável
    float shape = smoothstep(uThresholdMin, uThresholdMax, noise);

    // Misturar cores com base no valor da forma
    vec3 color = mix(uColor1, uColor2, shape);

    // Aplicar vibrância para cores mais vivas
    color = applyVibrance(color, 0.2);

    // Adicionar textura de grão/ruído com quantidade e escala ajustáveis
    float grain = snoise(uv * uGrainScale) * uGrainAmount; // Use uGrainScale here
    color += grain;

    // Aplicar correção de gama para melhor aparência visual
    color = gammaCorrect(color, 2.2);

    // Garantir que as cores estejam no intervalo válido
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`

// Removido o hook duplicado - agora usando o hook de hooks/use-device-optimizations.ts

// Shader component
function GradientShader() {
  // Get parameters from store using selectors to prevent unnecessary re-renders
  const isPlaying = useGradientStore(state => state.isPlaying)
  const speed = useGradientStore(state => state.speed)
  const complexity = useGradientStore(state => state.complexity)
  const noiseScale = useGradientStore(state => state.noiseScale)
  const colorScheme = useGradientStore(state => state.colorScheme)
  const colorSchemes = useGradientStore(state => state.colorSchemes)
  const isCustomMode = useGradientStore(state => state.isCustomMode)
  const customColors = useGradientStore(state => state.customColors)
  const flowIntensity = useGradientStore(state => state.flowIntensity)
  const grainAmount = useGradientStore(state => state.grainAmount)
  const grainScale = useGradientStore(state => state.grainScale)
  const thresholdMin = useGradientStore(state => state.thresholdMin)
  const thresholdMax = useGradientStore(state => state.thresholdMax)

  // Refs
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const timeRef = useRef(0)
  const frameSkipRef = useRef(0)

  // Get current color scheme
  const currentColorScheme = isCustomMode ? customColors : colorSchemes[colorScheme]

  // Set up scene
  const { size } = useThree()

  // Initialize shader material
  useEffect(() => {
    if (meshRef.current) {
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(size.width, size.height) },
          uComplexity: { value: complexity },
          uNoiseScale: { value: noiseScale },
          uColor1: { value: currentColorScheme.color1 },
          uColor2: { value: currentColorScheme.color2 },
          uFlowIntensity: { value: flowIntensity },
          uGrainAmount: { value: grainAmount },
          uGrainScale: { value: 500.0 }, // Add initial value for new uniform
          uThresholdMin: { value: thresholdMin },
          uThresholdMax: { value: thresholdMax },
        },
        transparent: true,
      })

      meshRef.current.material = material
      materialRef.current = material
    }
  }, [])

  // Update uniforms when parameters change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uComplexity.value = complexity
      materialRef.current.uniforms.uNoiseScale.value = noiseScale
      materialRef.current.uniforms.uColor1.value = currentColorScheme.color1
      materialRef.current.uniforms.uColor2.value = currentColorScheme.color2
      materialRef.current.uniforms.uFlowIntensity.value = flowIntensity
      materialRef.current.uniforms.uGrainAmount.value = grainAmount
      materialRef.current.uniforms.uGrainScale.value = grainScale // Update grainScale uniform
      materialRef.current.uniforms.uThresholdMin.value = thresholdMin
      materialRef.current.uniforms.uThresholdMax.value = thresholdMax
    }
  }, [complexity, noiseScale, currentColorScheme, flowIntensity, grainAmount, grainScale, thresholdMin, thresholdMax]) // Add grainScale to dependencies

  // Obter otimizações de dispositivo
  const { frameSkip, isMobile, isLowPower } = useDeviceOptimizations()

  // Animation loop with frame skipping for mobile devices
  useFrame((_, delta) => {
    if (materialRef.current) {
      // Para dispositivos móveis ou de baixa potência, podemos pular frames para melhorar o desempenho
      if (frameSkip > 0) {
        frameSkipRef.current = (frameSkipRef.current + 1) % (frameSkip + 1)
        if (frameSkipRef.current !== 0) return
      }

      if (isPlaying) {
        // Ajustar a velocidade da animação com base no dispositivo
        const adjustedSpeed = isMobile ? speed * 0.8 : speed
        timeRef.current += delta * adjustedSpeed
      }

      materialRef.current.uniforms.uTime.value = timeRef.current
    }
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[20, 20]} />
    </mesh>
  )
}

// Main scene component
export function GradientScene() {
  const [contextLost, setContextLost] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Device optimizations
  const { quality, pixelRatio, antialias } = useDeviceOptimizations()

  // Configure renderer based on device quality
  const glConfig = useMemo(() => {
    return {
      preserveDrawingBuffer: true, // Necessário para exportação de imagem
      antialias, // Desativar antialiasing em dispositivos de baixo desempenho
      powerPreference: (quality === 'high' ? 'high-performance' : 'low-power') as WebGLPowerPreference, // Cast to correct type
      depth: false, // Não precisamos de teste de profundidade para um gradiente 2D
      stencil: false, // Não precisamos de buffer de stencil
    }
  }, [quality, antialias])

  // Handle WebGL context loss
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleContextLost = (event: WebGLContextEvent) => {
      event.preventDefault()
      setContextLost(true)
    }

    const handleContextRestored = () => {
      setContextLost(false)
    }

    canvas.addEventListener('webglcontextlost', handleContextLost as EventListener)
    canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost as EventListener)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored as EventListener)
    }
  }, [])

  if (contextLost) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div className="text-center">
          <p className="text-lg mb-2">WebGL context lost</p>
          <p className="text-sm text-gray-400">Reloading...</p>
        </div>
      </div>
    )
  }

  return (
    <Canvas ref={canvasRef} gl={glConfig} camera={{ position: [0, 0, 5] }} dpr={[1, pixelRatio]}>
      <GradientShader />
    </Canvas>
  )
}
