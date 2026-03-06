import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Landmark, PoseLandmarks } from '../../services/PoseAnalysis/types';

interface PoseOverlayProps {
    landmarks: PoseLandmarks | null;
    width: number;
    height: number;
    // Opcional, color del esqueleto (verde fluor para éxito, rojo para error, etc)
    color?: string;
}

// Pares de índices (Landmark) que definen cómo se conectan los "huesos"
const CONNECTIONS = [
    // Torso
    [Landmark.LEFT_SHOULDER, Landmark.RIGHT_SHOULDER],
    [Landmark.LEFT_SHOULDER, Landmark.LEFT_HIP],
    [Landmark.RIGHT_SHOULDER, Landmark.RIGHT_HIP],
    [Landmark.LEFT_HIP, Landmark.RIGHT_HIP],
    // Brazo Derecho
    [Landmark.RIGHT_SHOULDER, Landmark.RIGHT_ELBOW],
    [Landmark.RIGHT_ELBOW, Landmark.RIGHT_WRIST],
    // Brazo Izquierdo
    [Landmark.LEFT_SHOULDER, Landmark.LEFT_ELBOW],
    [Landmark.LEFT_ELBOW, Landmark.LEFT_WRIST],
    // Pierna Derecha
    [Landmark.RIGHT_HIP, Landmark.RIGHT_KNEE],
    [Landmark.RIGHT_KNEE, Landmark.RIGHT_ANKLE],
    // Pierna Izquierda
    [Landmark.LEFT_HIP, Landmark.LEFT_KNEE],
    [Landmark.LEFT_KNEE, Landmark.LEFT_ANKLE],
];

/**
 * Componente visual puro (Dumb)
 * Recibe un array de coordenadas relativas [0..1] y las dibuja escaladas a su tamaño físico
 */
export const PoseOverlay: React.FC<PoseOverlayProps> = ({ landmarks, width, height, color = '#00FF00' }) => {

    if (!landmarks || landmarks.length === 0 || width === 0 || height === 0) {
        return null;
    }

    return (
        <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
            <Svg width="100%" height="100%">

                {/* 1. Dibujar los Huesos (Líneas) */}
                {CONNECTIONS.map(([startIdx, endIdx], i) => {
                    const startNode = landmarks[startIdx];
                    const endNode = landmarks[endIdx];

                    // Solo dibujar la línea si ambos puntos son lo suficientemente visibles/fiables
                    if (startNode && endNode && startNode.visibility! > 0.3 && endNode.visibility! > 0.3) {
                        return (
                            <Line
                                key={`line-${i}`}
                                x1={startNode.x * width}
                                y1={startNode.y * height}
                                x2={endNode.x * width}
                                y2={endNode.y * height}
                                stroke={color}
                                strokeWidth="3"
                                strokeOpacity="0.8"
                            />
                        );
                    }
                    return null;
                })}

                {/* 2. Dibujar las Articulaciones Clave (Círculos) */}
                {[
                    Landmark.LEFT_SHOULDER, Landmark.RIGHT_SHOULDER,
                    Landmark.LEFT_ELBOW, Landmark.RIGHT_ELBOW,
                    Landmark.LEFT_WRIST, Landmark.RIGHT_WRIST,
                    Landmark.LEFT_HIP, Landmark.RIGHT_HIP,
                    Landmark.LEFT_KNEE, Landmark.RIGHT_KNEE,
                    Landmark.LEFT_ANKLE, Landmark.RIGHT_ANKLE
                ].map((idx) => {
                    const node = landmarks[idx];
                    if (node && node.visibility! > 0.3) {
                        return (
                            <Circle
                                key={`point-${idx}`}
                                cx={node.x * width}
                                cy={node.y * height}
                                r="4"
                                fill="#FFFFFF"
                                stroke={color}
                                strokeWidth="2"
                            />
                        );
                    }
                    return null;
                })}
            </Svg>
        </View>
    );
};
