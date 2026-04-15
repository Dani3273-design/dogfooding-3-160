const { createApp, ref, onMounted, onUnmounted } = Vue;

createApp({
    setup() {
        const isMobile = ref(false);
        const fireworkCount = ref(0);
        let scene, camera, renderer;
        let launcherGroup, launcherBody;
        let fireworks = [];
        let particles = [];
        let fishes = [];
        let stars = [];
        let ripples = [];
        let lastFireTime = 0;
        let mouseX = 0, mouseY = 0;
        let targetCameraX = 0, targetCameraY = 0;
        let audioContext;
        let trailTexture;
        
        // 祝福语列表
        const blessings = [
            "心想事成", "万事如意", "前程似锦", "幸福安康",
            "财源广进", "阖家欢乐", "步步高升", "梦想成真",
            "平安喜乐", "好运连连", "笑口常开", "福星高照"
        ];
        
        // 烟花颜色配置
        const fireworkStyles = [
            { colors: [0xff0040, 0xff4080, 0xff8080], type: 'sphere' },
            { colors: [0x00ff80, 0x40ff80, 0x80ff80], type: 'sphere' },
            { colors: [0x4000ff, 0x8040ff, 0x8080ff], type: 'sphere' },
            { colors: [0xffff00, 0xffc000, 0xff8000], type: 'sphere' },
            { colors: [0x00ffff, 0x40c0ff, 0x8080ff], type: 'sphere' },
            { colors: [0xff00ff, 0xff40c0, 0xff8080], type: 'ring' },
            { colors: [0x00ff00, 0x40ff40, 0x80ff80], type: 'ring' },
            { colors: [0xff0000, 0xff4040, 0xff8080], type: 'heart' },
            { colors: [0xffd700, 0xffec8b, 0xfffacd], type: 'star' },
            { colors: [0xff69b4, 0xff1493, 0xffc0cb], type: 'flower' },
            { colors: [0x00ced1, 0x40e0d0, 0xafeeee], type: 'double' },
            { colors: [0xff4500, 0xff6347, 0xffa07a], type: 'willow' }
        ];
        
        // 鱼的样式
        const fishStyles = [
            { color: 0xff6b6b, scale: 1 },
            { color: 0x4ecdc4, scale: 0.8 },
            { color: 0xffe66d, scale: 1.2 },
            { color: 0xa8e6cf, scale: 0.9 },
            { color: 0xff8b94, scale: 1.1 },
            { color: 0x6c5ce7, scale: 0.7 },
            { color: 0xfd79a8, scale: 1 },
            { color: 0x00b894, scale: 0.85 },
            { color: 0xe17055, scale: 1.15 },
            { color: 0x74b9ff, scale: 0.95 }
        ];
        
        const checkMobile = () => {
            const userAgent = navigator.userAgent.toLowerCase();
            const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'windows phone', 'mobile'];
            isMobile.value = mobileKeywords.some(keyword => userAgent.includes(keyword));
        };
        
        const initAudio = () => {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Audio not supported');
            }
        };
        
        const playLaunchSound = () => {
            if (!audioContext) return;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        };
        
        const playExplosionSound = () => {
            if (!audioContext) return;
            const bufferSize = audioContext.sampleRate * 0.6;
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
            }
            const source = audioContext.createBufferSource();
            const gainNode = audioContext.createGain();
            source.buffer = buffer;
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
            source.start(audioContext.currentTime);
        };
        
        const initScene = () => {
            scene = new THREE.Scene();
            scene.fog = new THREE.Fog(0x0a1628, 50, 200);
            
            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 10, 40);
            camera.lookAt(0, 15, 0);
            
            renderer = new THREE.WebGLRenderer({ 
                canvas: document.getElementById('fireworks-canvas'),
                antialias: true,
                alpha: true
            });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x0a1628, 1);
        };
        
        const createSky = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, 512);
            gradient.addColorStop(0, '#050a14');
            gradient.addColorStop(0.3, '#0a1628');
            gradient.addColorStop(0.6, '#1a2d4a');
            gradient.addColorStop(1, '#2d4a6a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);
            
            const texture = new THREE.CanvasTexture(canvas);
            scene.background = texture;
        };
        
        // 创建星星（增强闪烁）
        const createStars = () => {
            for (let i = 0; i < 300; i++) {
                const starGroup = new THREE.Group();
                
                // 十字星形状
                const size = 0.06 + Math.random() * 0.1;
                const geometry = new THREE.BufferGeometry();
                const vertices = new Float32Array([
                    0, size, 0,
                    size * 0.25, 0, 0,
                    0, -size, 0,
                    -size * 0.25, 0, 0,
                    0, 0, size * 0.25,
                    0, 0, -size * 0.25
                ]);
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                
                const material = new THREE.PointsMaterial({
                    color: 0xffffff,
                    size: 0.08,
                    transparent: true,
                    opacity: 0.5 + Math.random() * 0.5,
                    blending: THREE.AdditiveBlending
                });
                
                const star = new THREE.Points(geometry, material);
                starGroup.add(star);
                
                starGroup.position.set(
                    (Math.random() - 0.5) * 180,
                    30 + Math.random() * 70,
                    (Math.random() - 0.5) * 80 - 40
                );
                
                starGroup.userData = {
                    twinkleSpeed: 0.03 + Math.random() * 0.04,
                    baseOpacity: material.opacity,
                    phase: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.03
                };
                
                scene.add(starGroup);
                stars.push(starGroup);
            }
        };
        
        // 创建带不规则边界的大海（静态）
        const createOcean = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, 512);
            gradient.addColorStop(0, '#1a3a5c');
            gradient.addColorStop(0.5, '#0f2a4a');
            gradient.addColorStop(1, '#0a1f3a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);
            
            ctx.strokeStyle = 'rgba(100, 150, 200, 0.15)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 30; i++) {
                ctx.beginPath();
                ctx.moveTo(0, i * 17);
                for (let x = 0; x <= 512; x += 20) {
                    ctx.lineTo(x, i * 17 + Math.sin(x * 0.02) * 5);
                }
                ctx.stroke();
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 2);
            
            // 不规则边界的大海
            const oceanGeometry = new THREE.PlaneGeometry(200, 60, 80, 30);
            const oceanMaterial = new THREE.MeshPhongMaterial({
                map: texture,
                color: 0x6699cc,
                transparent: true,
                opacity: 0.9,
                shininess: 80,
                specular: 0x88aacc
            });
            const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
            ocean.rotation.x = -Math.PI / 2;
            ocean.position.y = -2;
            ocean.position.z = -10;
            
            // 静态不规则边界
            const positions = ocean.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                
                // 使用噪声函数创建不规则边界
                const noise1 = Math.sin(x * 0.08) * 1.2;
                const noise2 = Math.cos(x * 0.15 + 1) * 0.8;
                const noise3 = Math.sin(x * 0.03 + 2) * 1.5;
                const noise4 = Math.cos(y * 0.1) * 0.5;
                
                // 沙滩边界处的不规则波浪
                const beachBoundary = Math.sin(x * 0.05) * 2 + Math.cos(x * 0.12) * 1.5;
                
                const z = noise1 + noise2 + noise3 + noise4 + beachBoundary * 0.3;
                positions.setZ(i, z);
            }
            ocean.geometry.computeVertexNormals();
            
            scene.add(ocean);
        };
        
        // 创建带不规则边界的沙滩
        const createBeach = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#c4a574';
            ctx.fillRect(0, 0, 512, 512);
            
            for (let i = 0; i < 5000; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const size = Math.random() * 2;
                const shade = Math.random();
                ctx.fillStyle = shade > 0.5 ? '#d4b584' : '#b49464';
                ctx.fillRect(x, y, size, size);
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(3, 1);
            
            // 不规则边界的沙滩
            const beachGeometry = new THREE.PlaneGeometry(200, 35, 60, 15);
            const beachMaterial = new THREE.MeshLambertMaterial({
                map: texture,
                color: 0xddc4a0
            });
            const beach = new THREE.Mesh(beachGeometry, beachMaterial);
            beach.rotation.x = -Math.PI / 2;
            beach.position.y = -2;
            beach.position.z = 32;
            
            const positions = beach.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const z = positions.getZ(i);
                
                // 不规则起伏
                const noise1 = Math.sin(x * 0.06) * 0.8;
                const noise2 = Math.cos(x * 0.12 + 1) * 0.5;
                const noise3 = Math.sin(z * 0.08) * 0.4;
                
                // 向海倾斜
                const slope = (z + 17.5) / 35 * 2;
                
                // 海边界处的不规则
                const oceanBoundary = Math.sin(x * 0.07) * 1.2 + Math.cos(x * 0.15) * 0.8;
                
                positions.setZ(i, noise1 + noise2 + noise3 + slope + oceanBoundary * 0.2);
            }
            beach.geometry.computeVertexNormals();
            
            scene.add(beach);
        };
        
        // 创建烟花发射筒（更明显）
        const createLauncher = () => {
            launcherGroup = new THREE.Group();
            
            // 主体 - 金色
            const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.55, 3, 20);
            const bodyMaterial = new THREE.MeshPhongMaterial({
                color: 0xffd700,
                shininess: 120,
                specular: 0xffffff
            });
            launcherBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
            launcherBody.position.y = 1.5;
            launcherGroup.add(launcherBody);
            
            // 红色条纹
            for (let i = 0; i < 4; i++) {
                const ringGeometry = new THREE.CylinderGeometry(0.41 + i * 0.015, 0.41 + i * 0.015, 0.2, 20);
                const ringMaterial = new THREE.MeshPhongMaterial({
                    color: 0xff2222,
                    shininess: 100
                });
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.position.y = 0.4 + i * 0.7;
                launcherGroup.add(ring);
            }
            
            // 顶部红边
            const topGeometry = new THREE.TorusGeometry(0.4, 0.1, 10, 24);
            const topMaterial = new THREE.MeshPhongMaterial({
                color: 0xff0000,
                shininess: 100
            });
            const top = new THREE.Mesh(topGeometry, topMaterial);
            top.position.y = 3;
            top.rotation.x = Math.PI / 2;
            launcherGroup.add(top);
            
            // 底座
            const baseGeometry = new THREE.CylinderGeometry(1, 1.2, 0.5, 20);
            const baseMaterial = new THREE.MeshPhongMaterial({
                color: 0x333333,
                shininess: 60
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 0.25;
            launcherGroup.add(base);
            
            // 三脚架
            for (let i = 0; i < 3; i++) {
                const legGeometry = new THREE.CylinderGeometry(0.1, 0.07, 1.5, 10);
                const legMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });
                const leg = new THREE.Mesh(legGeometry, legMaterial);
                const angle = (i / 3) * Math.PI * 2;
                leg.position.set(Math.cos(angle) * 0.6, 0.4, Math.sin(angle) * 0.6);
                leg.rotation.z = Math.cos(angle) * 0.4;
                leg.rotation.x = Math.sin(angle) * 0.4;
                launcherGroup.add(leg);
            }
            
            // 放置在画面底部中央，确保可见
            launcherGroup.position.set(0, -1.8, 20);
            scene.add(launcherGroup);
        };
        
        // 创建拖尾纹理
        const createTrailTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, 128);
            gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
            gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)');
            gradient.addColorStop(0.7, 'rgba(255, 100, 50, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 32, 128);
            
            trailTexture = new THREE.CanvasTexture(canvas);
        };
        
        // 创建鱼
        const createFish = () => {
            const style = fishStyles[Math.floor(Math.random() * fishStyles.length)];
            const fishGroup = new THREE.Group();
            
            // 鱼身
            const bodyGeometry = new THREE.SphereGeometry(0.25, 12, 8);
            bodyGeometry.scale(2, 1, 0.6);
            const bodyMaterial = new THREE.MeshPhongMaterial({
                color: style.color,
                shininess: 60
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            fishGroup.add(body);
            
            // 鱼尾组（可摆动）
            const tailGroup = new THREE.Group();
            const tailGeometry = new THREE.BufferGeometry();
            const tailVertices = new Float32Array([
                0, 0, 0,
                -0.6, 0.4, 0,
                -0.4, 0, 0,
                -0.6, -0.4, 0
            ]);
            const tailIndices = [0, 1, 2, 0, 2, 3];
            tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
            tailGeometry.setIndex(tailIndices);
            tailGeometry.computeVertexNormals();
            
            const tailMaterial = new THREE.MeshPhongMaterial({
                color: style.color,
                side: THREE.DoubleSide
            });
            const tail = new THREE.Mesh(tailGeometry, tailMaterial);
            tailGroup.add(tail);
            tailGroup.position.x = -0.4;
            fishGroup.add(tailGroup);
            
            // 背鳍
            const dorsalFinGeometry = new THREE.BufferGeometry();
            const dorsalVertices = new Float32Array([
                0, 0.25, 0,
                -0.2, 0.6, 0,
                0.2, 0.6, 0
            ]);
            dorsalFinGeometry.setAttribute('position', new THREE.BufferAttribute(dorsalVertices, 3));
            dorsalFinGeometry.computeVertexNormals();
            const dorsalFin = new THREE.Mesh(dorsalFinGeometry, tailMaterial);
            fishGroup.add(dorsalFin);
            
            // 侧鳍
            const sideFinGeometry = new THREE.BufferGeometry();
            const sideFinVertices = new Float32Array([
                0.1, 0, 0.15,
                -0.1, -0.3, 0.3,
                0.2, -0.1, 0.2
            ]);
            sideFinGeometry.setAttribute('position', new THREE.BufferAttribute(sideFinVertices, 3));
            sideFinGeometry.computeVertexNormals();
            const sideFin1 = new THREE.Mesh(sideFinGeometry, tailMaterial);
            fishGroup.add(sideFin1);
            const sideFin2 = sideFin1.clone();
            sideFin2.scale.z = -1;
            fishGroup.add(sideFin2);
            
            fishGroup.scale.setScalar(style.scale);
            
            // 初始位置（水下深处）
            fishGroup.position.set(
                (Math.random() - 0.5) * 50,
                -5,
                -8 - Math.random() * 20
            );
            
            fishGroup.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    0,
                    (Math.random() - 0.5) * 0.05
                ),
                isJumping: false,
                jumpTime: 0,
                jumpStartPos: null,
                jumpVelocity: null,
                tailGroup: tailGroup,
                tailWagPhase: Math.random() * Math.PI * 2,
                isUnderwater: true
            };
            
            scene.add(fishGroup);
            fishes.push(fishGroup);
        };
        
        // 创建水波纹（更细）
        const createRipple = (position) => {
            const rippleGeometry = new THREE.RingGeometry(0.1, 0.2, 32);
            const rippleMaterial = new THREE.MeshBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
            ripple.position.copy(position);
            ripple.position.y = -1.95;
            ripple.rotation.x = -Math.PI / 2;
            scene.add(ripple);
            
            ripples.push({
                mesh: ripple,
                scale: 1,
                opacity: 0.5,
                age: 0
            });
        };
        
        // 发射烟花
        const launchFirework = () => {
            const now = Date.now();
            if (now - lastFireTime < 500) return;
            lastFireTime = now;
            fireworkCount.value++;
            
            playLaunchSound();
            
            // 鼓包动画
            let bulgePhase = 0;
            const bulgeAnimation = () => {
                bulgePhase += 0.15;
                const scale = 1 + Math.sin(bulgePhase) * 0.35 * Math.exp(-bulgePhase);
                launcherBody.scale.set(1, scale, 1);
                
                if (bulgePhase < Math.PI * 2) {
                    requestAnimationFrame(bulgeAnimation);
                } else {
                    launcherBody.scale.set(1, 1, 1);
                }
            };
            bulgeAnimation();
            
            // 创建烟花弹
            const fireworkGroup = new THREE.Group();
            
            const fireworkGeometry = new THREE.SphereGeometry(0.12, 8, 8);
            const fireworkMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
            const firework = new THREE.Mesh(fireworkGeometry, fireworkMaterial);
            fireworkGroup.add(firework);
            
            // 拖尾
            const trailGeometry = new THREE.PlaneGeometry(0.25, 4);
            const trailMaterial = new THREE.MeshBasicMaterial({
                map: trailTexture,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            trail.position.y = -2;
            fireworkGroup.add(trail);
            
            // 从发射筒口发射
            const startPos = new THREE.Vector3(0, 1.2, 20);
            fireworkGroup.position.copy(startPos);
            
            // 目标位置（限制在画面内）
            const targetX = (Math.random() - 0.5) * 20;
            const targetY = 18 + Math.random() * 12;
            const targetZ = -5 + (Math.random() - 0.5) * 10;
            const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
            
            scene.add(fireworkGroup);
            
            // 计算方向使拖尾指向炮筒
            const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
            fireworkGroup.lookAt(targetPos);
            
            fireworks.push({
                mesh: fireworkGroup,
                startPos: startPos.clone(),
                targetPos: targetPos,
                direction: direction,
                progress: 0,
                speed: 0.015 + Math.random() * 0.005
            });
        };
        
        // 创建爆炸
        const createExplosion = (position, style) => {
            playExplosionSound();
            
            const particleCount = 100 + Math.random() * 50;
            const colors = style.colors;
            const isBlessing = Math.random() < 0.1;
            
            for (let i = 0; i < particleCount; i++) {
                const particleGeometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 6, 6);
                const color = colors[Math.floor(Math.random() * colors.length)];
                const particleMaterial = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 1
                });
                const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.position.copy(position);
                
                let velocity;
                const angle = Math.random() * Math.PI * 2;
                
                switch (style.type) {
                    case 'ring':
                        velocity = new THREE.Vector3(
                            Math.cos(angle) * 1.2,
                            Math.sin(angle) * 1.2 * 0.2,
                            (Math.random() - 0.5) * 0.3
                        );
                        break;
                    case 'heart':
                        const ha = (i / particleCount) * Math.PI * 2;
                        const hx = 16 * Math.pow(Math.sin(ha), 3);
                        const hy = 13 * Math.cos(ha) - 5 * Math.cos(2*ha) - 2 * Math.cos(3*ha) - Math.cos(4*ha);
                        velocity = new THREE.Vector3(hx * 0.05, hy * 0.05, (Math.random() - 0.5) * 0.3);
                        break;
                    case 'star':
                        const sa = (i / particleCount) * Math.PI * 2;
                        const isOuter = i % 2 === 0;
                        const sr = isOuter ? 1.5 : 0.6;
                        velocity = new THREE.Vector3(
                            Math.cos(sa) * sr,
                            Math.sin(sa) * sr,
                            (Math.random() - 0.5) * 0.3
                        );
                        break;
                    case 'flower':
                        const petals = 6;
                        const petalAngle = (i % petals) * (Math.PI * 2 / petals);
                        const dist = 0.3 + Math.random() * 1;
                        velocity = new THREE.Vector3(
                            Math.cos(petalAngle) * dist + (Math.random() - 0.5) * 0.5,
                            Math.sin(petalAngle) * dist + (Math.random() - 0.5) * 0.5,
                            (Math.random() - 0.5) * 0.4
                        );
                        break;
                    case 'willow':
                        velocity = new THREE.Vector3(
                            (Math.random() - 0.5) * 0.6,
                            Math.random() * 0.3,
                            (Math.random() - 0.5) * 0.6
                        );
                        break;
                    default:
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        const r = 0.8 + Math.random() * 0.5;
                        velocity = new THREE.Vector3(
                            r * Math.sin(phi) * Math.cos(theta),
                            r * Math.sin(phi) * Math.sin(theta),
                            r * Math.cos(phi)
                        );
                }
                
                scene.add(particle);
                particles.push({
                    mesh: particle,
                    velocity: velocity,
                    life: 1,
                    decay: 0.006 + Math.random() * 0.006,
                    gravity: style.type === 'willow' ? -0.012 : -0.004,
                    isWillow: style.type === 'willow'
                });
            }
            
            if (isBlessing) {
                createBlessingFirework(position, colors[0]);
            }
        };
        
        // 祝福烟花
        const createBlessingFirework = (position, color) => {
            const blessing = blessings[Math.floor(Math.random() * blessings.length)];
            
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.fillText(blessing, 128, 64);
            
            const imageData = ctx.getImageData(0, 0, 256, 128);
            const data = imageData.data;
            
            for (let y = 0; y < 128; y += 3) {
                for (let x = 0; x < 256; x += 3) {
                    const index = (y * 256 + x) * 4;
                    if (data[index + 3] > 128) {
                        const px = (x - 128) / 18;
                        const py = -(y - 64) / 18;
                        
                        const particleGeometry = new THREE.SphereGeometry(0.06, 6, 6);
                        const particleMaterial = new THREE.MeshBasicMaterial({
                            color: color,
                            transparent: true,
                            opacity: 1
                        });
                        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                        particle.position.set(
                            position.x + px + (Math.random() - 0.5) * 0.2,
                            position.y + py + (Math.random() - 0.5) * 0.2,
                            position.z + (Math.random() - 0.5) * 0.2
                        );
                        
                        scene.add(particle);
                        particles.push({
                            mesh: particle,
                            velocity: new THREE.Vector3(
                                (Math.random() - 0.5) * 0.08,
                                (Math.random() - 0.5) * 0.08,
                                (Math.random() - 0.5) * 0.08
                            ),
                            life: 1.2,
                            decay: 0.003,
                            gravity: -0.001,
                            isBlessing: true
                        });
                    }
                }
            }
        };
        
        // 动画循环
        const animate = () => {
            requestAnimationFrame(animate);
            
            const time = Date.now() * 0.001;
            
            // 相机视差（限制范围确保所有元素可见）
            targetCameraX = mouseX * 2;
            targetCameraY = mouseY * 1.5;
            camera.position.x += (targetCameraX - camera.position.x) * 0.03;
            camera.position.y += (10 + targetCameraY - camera.position.y) * 0.03;
            camera.lookAt(0, 12, 0);
            
            // 星星闪烁（增强）
            stars.forEach(star => {
                const twinkle = Math.sin(time * star.userData.twinkleSpeed * 80 + star.userData.phase);
                const opacity = star.userData.baseOpacity + twinkle * 0.4;
                star.children[0].material.opacity = Math.max(0.1, Math.min(1, opacity));
                star.rotation.z += star.userData.rotationSpeed;
            });
            
            // 更新烟花发射
            for (let i = fireworks.length - 1; i >= 0; i--) {
                const fw = fireworks[i];
                fw.progress += fw.speed;
                
                const currentPos = new THREE.Vector3().lerpVectors(
                    fw.startPos,
                    fw.targetPos,
                    fw.progress
                );
                
                fw.mesh.position.copy(currentPos);
                
                // 保持拖尾指向炮筒方向
                fw.mesh.lookAt(fw.targetPos);
                
                if (fw.progress >= 1) {
                    const style = fireworkStyles[Math.floor(Math.random() * fireworkStyles.length)];
                    createExplosion(fw.targetPos, style);
                    scene.remove(fw.mesh);
                    fireworks.splice(i, 1);
                }
            }
            
            // 更新粒子
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.life -= p.decay;
                
                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    particles.splice(i, 1);
                    continue;
                }
                
                p.velocity.y += p.gravity;
                if (p.isWillow && p.velocity.y < -0.25) {
                    p.velocity.y = -0.25;
                }
                
                p.mesh.position.add(p.velocity.clone().multiplyScalar(0.25));
                p.mesh.material.opacity = p.life;
                
                if (!p.isWillow && !p.isBlessing) {
                    p.velocity.multiplyScalar(0.985);
                }
            }
            
            // 更新鱼（物理效果）
            fishes.forEach((fish) => {
                const data = fish.userData;
                
                // 尾巴摆动
                data.tailWagPhase += 0.15;
                
                if (!data.isJumping) {
                    // 水下游动
                    if (fish.visible && fish.position.y < -1.5) {
                        data.tailGroup.rotation.y = Math.sin(data.tailWagPhase) * 0.3;
                        fish.position.add(data.velocity);
                        fish.rotation.y = Math.atan2(data.velocity.x, data.velocity.z);
                        fish.rotation.z = 0;
                        
                        if (Math.abs(fish.position.x) > 35) {
                            data.velocity.x *= -1;
                        }
                        if (fish.position.z > -5 || fish.position.z < -30) {
                            data.velocity.z *= -1;
                        }
                    }
                    
                    // 随机跳跃
                    if (Math.random() < 0.001 && fish.visible) {
                        data.isJumping = true;
                        data.jumpTime = 0;
                        data.jumpStartPos = fish.position.clone();
                        
                        // 跳跃初速度（斜向上）
                        const jumpAngle = Math.random() * Math.PI * 0.3 + Math.PI * 0.35;
                        const jumpSpeed = 0.5 + Math.random() * 0.2;
                        data.jumpVelocity = new THREE.Vector3(
                            Math.cos(jumpAngle) * (Math.random() - 0.5) * 0.3,
                            Math.sin(jumpAngle) * jumpSpeed,
                            (Math.random() - 0.5) * 0.1
                        );
                        
                        createRipple(fish.position);
                    }
                } else {
                    // 跳跃物理
                    data.jumpTime += 0.016;
                    
                    // 重力加速度（上升慢，下降快）
                    const gravity = -0.012;
                    data.jumpVelocity.y += gravity;
                    
                    // 位置更新
                    fish.position.add(data.jumpVelocity);
                    
                    // 根据速度方向调整朝向
                    const speed = data.jumpVelocity.length();
                    const angle = Math.atan2(data.jumpVelocity.y, 
                        Math.sqrt(data.jumpVelocity.x * data.jumpVelocity.x + data.jumpVelocity.z * data.jumpVelocity.z));
                    
                    // 头朝向速度方向
                    fish.rotation.y = Math.atan2(data.jumpVelocity.x, data.jumpVelocity.z);
                    fish.rotation.z = -angle * 0.8;
                    
                    // 快速摆尾
                    data.tailGroup.rotation.y = Math.sin(data.tailWagPhase * 4) * 0.5;
                    
                    // 顶点短暂停留效果（速度接近0时）
                    if (Math.abs(data.jumpVelocity.y) < 0.05 && fish.position.y > 2) {
                        data.jumpVelocity.multiplyScalar(0.98);
                    }
                    
                    // 出水波纹
                    if (fish.position.y > -1.5 && !data.hasRipple) {
                        createRipple(fish.position);
                        data.hasRipple = true;
                    }
                    
                    // 落水检测
                    if (fish.position.y < -2 && data.jumpVelocity.y < 0) {
                        createRipple(fish.position);
                        
                        // 入水消失
                        fish.visible = false;
                        data.isJumping = false;
                        data.hasRipple = false;
                        
                        // 重置位置到水下
                        setTimeout(() => {
                            fish.visible = true;
                            fish.position.copy(data.jumpStartPos);
                            fish.position.y = -5;
                            fish.rotation.z = 0;
                            fish.rotation.x = 0;
                        }, 500 + Math.random() * 1000);
                    }
                }
            });
            
            // 更新水波纹
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                r.age += 0.02;
                r.scale += 0.08;
                r.opacity -= 0.012;
                
                if (r.opacity <= 0) {
                    scene.remove(r.mesh);
                    ripples.splice(i, 1);
                } else {
                    r.mesh.scale.setScalar(r.scale);
                    r.mesh.material.opacity = r.opacity;
                }
            }
            
            renderer.render(scene, camera);
        };
        
        const onMouseMove = (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        };
        
        const onClick = () => {
            if (!isMobile.value) {
                launchFirework();
            }
        };
        
        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        
        onMounted(() => {
            checkMobile();
            
            if (!isMobile.value) {
                initAudio();
                initScene();
                createSky();
                createStars();
                createOcean();
                createBeach();
                createLauncher();
                createTrailTexture();
                
                for (let i = 0; i < 8; i++) {
                    createFish();
                }
                
                const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
                scene.add(ambientLight);
                
                const moonLight = new THREE.DirectionalLight(0xaaccff, 0.6);
                moonLight.position.set(10, 50, 20);
                scene.add(moonLight);
                
                const launcherLight = new THREE.PointLight(0xffdd88, 1, 25);
                launcherLight.position.set(0, 5, 22);
                scene.add(launcherLight);
                
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('click', onClick);
                window.addEventListener('resize', onResize);
                
                animate();
                
                setTimeout(() => {
                    launchFirework();
                }, 1000);
            }
        });
        
        onUnmounted(() => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('click', onClick);
            window.removeEventListener('resize', onResize);
        });
        
        return {
            isMobile,
            fireworkCount
        };
    }
}).mount('#app');
