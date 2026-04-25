import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';

// The "Entity"
const AvatarCore = ({ userDiscipline }) => {
    const mesh = useRef();
    const [hovered, setHover] = useState(false);

    // Animation Loop
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        // Rotate
        mesh.current.rotation.x = time * 0.2;
        mesh.current.rotation.y = time * 0.3;
        
        // "Breathe" based on mouse hover (or AI processing state later)
        const scale = hovered ? 1.2 : 1;
        mesh.current.scale.lerp({ x: scale, y: scale, z: scale }, 0.1);
    });

    // Dynamic Material based on User Profile (The "Reflection")
    let color = "#444"; // Default Grey
    let distort = 0.3;  // Default wobbly
    let wireframe = true; // Stage 0 is always wireframe

    if (userDiscipline === 'Code Architect') {
        color = "#00ffff"; // Cyan
        distort = 0;       // Structured/Logic
    } else if (userDiscipline === 'Security') {
        color = "#ff5252"; // Red
        distort = 0.6;     // Chaotic/Fluid
    }

    return (
        <Sphere args={[1, 64, 64]} ref={mesh} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
            <MeshDistortMaterial 
                color={color} 
                attach="material" 
                distort={distort} 
                speed={2} 
                wireframe={wireframe} 
                transparent
                opacity={0.8}
            />
        </Sphere>
    );
};

const MagicMirror = ({ user }) => {
    // Positioning: Bottom Right (Clippy Style)
    const style = {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '150px',
        height: '150px',
        zIndex: 9999,
        pointerEvents: 'auto', // Allow clicking the 3D object
    };

    return (
        <div style={style}>
            <Canvas camera={{ position: [0, 0, 3] }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <AvatarCore userDiscipline={user?.discipline} />
            </Canvas>
            {/* Optional Context Text */}
            <div style={{
                textAlign: 'center', 
                color: 'rgba(255,255,255,0.5)', 
                fontSize: '0.7em', 
                marginTop: '-10px'
            }}>
                {user?.name ? "System Active" : "Waiting..."}
            </div>
        </div>
    );
};

export default MagicMirror;