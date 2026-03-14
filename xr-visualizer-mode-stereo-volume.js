(function() {
	const utils = window.xrVisualizerUtils;
	const defaultAudioMetrics = {level: 0, peak: 0, bass: 0, transient: 0, beatPulse: 0};
	const stageConfig = {
		distance: 5.4,
		width: 7.2,
		height: 4.3,
		shapeDepthStep: 0.35,
		waveDepthStep: 0.32
	};

	const colorVertexSource = [
		"attribute vec3 position;",
		"attribute vec4 color;",
		"uniform mat4 viewMatrix;",
		"uniform mat4 projMatrix;",
		"varying vec4 vColor;",
		"void main(){",
		"vColor=color;",
		"gl_Position=projMatrix*viewMatrix*vec4(position,1.0);",
		"}"
	].join("");

	const colorFragmentSource = [
		"precision mediump float;",
		"varying vec4 vColor;",
		"void main(){",
		"gl_FragColor=vColor;",
		"}"
	].join("");

	const clampColor = function(value) {
		return utils.clampNumber(Number.isFinite(value) ? value : 0, 0, 1);
	};

	const pushVec3 = function(target, x, y, z) {
		target.push(x, y, z);
	};

	const pushVec4 = function(target, r, g, b, a) {
		target.push(clampColor(r), clampColor(g), clampColor(b), clampColor(a));
	};

	const mixColor = function(a, b, t) {
		return [
			a[0] + (b[0] - a[0]) * t,
			a[1] + (b[1] - a[1]) * t,
			a[2] + (b[2] - a[2]) * t,
			a[3] + (b[3] - a[3]) * t
		];
	};

	const addScaledVec3 = function(base, dir, scale) {
		return {
			x: base.x + dir.x * scale,
			y: base.y + dir.y * scale,
			z: base.z + dir.z * scale
		};
	};

	const addBasisOffset = function(base, right, up, forward, offsetX, offsetY, offsetZ) {
		return {
			x: base.x + right.x * offsetX + up.x * offsetY + forward.x * offsetZ,
			y: base.y + right.y * offsetX + up.y * offsetY + forward.y * offsetZ,
			z: base.z + right.z * offsetX + up.z * offsetY + forward.z * offsetZ
		};
	};

	const extractHeadBasis = function(frameState) {
		const cosYaw = Math.cos(frameState.headYaw);
		const sinYaw = Math.sin(frameState.headYaw);
		const cosPitch = Math.cos(frameState.headPitch);
		const sinPitch = Math.sin(frameState.headPitch);
		const forward = {
			x: sinYaw * cosPitch,
			y: sinPitch,
			z: -cosYaw * cosPitch
		};
		const right = {
			x: cosYaw,
			y: 0,
			z: sinYaw
		};
		const up = {
			x: -sinYaw * sinPitch,
			y: cosPitch,
			z: cosYaw * sinPitch
		};
		return {
			right: right,
			up: up,
			forward: forward,
			position: {
				x: frameState.headPositionX,
				y: frameState.headPositionY,
				z: frameState.headPositionZ
			}
		};
	};

	const getShapeColor = function(baseVals, useSecondaryBool) {
		return [
			useSecondaryBool ? clampColor(baseVals.r2 !== undefined ? baseVals.r2 : baseVals.r) : clampColor(baseVals.r !== undefined ? baseVals.r : 1),
			useSecondaryBool ? clampColor(baseVals.g2 !== undefined ? baseVals.g2 : baseVals.g) : clampColor(baseVals.g !== undefined ? baseVals.g : 1),
			useSecondaryBool ? clampColor(baseVals.b2 !== undefined ? baseVals.b2 : baseVals.b) : clampColor(baseVals.b !== undefined ? baseVals.b : 1),
			useSecondaryBool ? clampColor(baseVals.a2 !== undefined ? baseVals.a2 : baseVals.a) : clampColor(baseVals.a !== undefined ? baseVals.a : 0.75)
		];
	};

	const compileShapeDescriptor = function(shape, index, totalCount) {
		const baseVals = shape && shape.baseVals ? shape.baseVals : null;
		if (!baseVals || !baseVals.enabled) {
			return null;
		}
		return {
			index: index,
			centerX: Number.isFinite(baseVals.x) ? baseVals.x : 0.5,
			centerY: Number.isFinite(baseVals.y) ? baseVals.y : 0.5,
			radius: Math.max(0.08, Number.isFinite(baseVals.rad) ? baseVals.rad : 0.2),
			sides: Math.max(3, Math.min(48, Math.round(baseVals.sides || 24))),
			angle: Number.isFinite(baseVals.ang) ? baseVals.ang : 0,
			depthOffset: (index - totalCount * 0.5) * stageConfig.shapeDepthStep,
			centerColor: getShapeColor(baseVals, true),
			edgeColor: getShapeColor(baseVals, false)
		};
	};

	const compileWaveDescriptor = function(wave, index, totalCount) {
		const baseVals = wave && wave.baseVals ? wave.baseVals : null;
		if (!baseVals || !baseVals.enabled) {
			return null;
		}
		return {
			index: index,
			sampleCount: Math.max(24, Math.min(128, Math.round(baseVals.samples || 64))),
			scaling: Number.isFinite(baseVals.scaling) ? baseVals.scaling : 1,
			spectrum: !!baseVals.spectrum,
			additive: !!baseVals.additive,
			depthOffset: (index - totalCount * 0.5) * stageConfig.waveDepthStep,
			baseColor: [
				clampColor(baseVals.r !== undefined ? baseVals.r : 0.7),
				clampColor(baseVals.g !== undefined ? baseVals.g : 0.8),
				clampColor(baseVals.b !== undefined ? baseVals.b : 1),
				utils.clampNumber(baseVals.a !== undefined ? baseVals.a : 0.9, 0.18, 1)
			]
		};
	};

	window.registerXrVisualizerMode("stereoVolume", function() {
		return {
			gl: null,
			source: null,
			program: null,
			positionLoc: null,
			colorLoc: null,
			viewMatrixLoc: null,
			projMatrixLoc: null,
			shapePositionBuffer: null,
			shapeColorBuffer: null,
			wavePositionBuffer: null,
			waveColorBuffer: null,
			shapeVertexCount: 0,
			waveVertexCount: 0,
			compiledPresetVersion: -1,
			compiledScene: {
				shapes: [],
				waves: []
			},
			init: function(options) {
				this.gl = options.gl;
				this.source = options.source;
				this.program = window.xrVisualizerGlUtils.createProgram(this.gl, colorVertexSource, colorFragmentSource, "Stereo preset 3D mode");
				this.positionLoc = this.gl.getAttribLocation(this.program, "position");
				this.colorLoc = this.gl.getAttribLocation(this.program, "color");
				this.viewMatrixLoc = this.gl.getUniformLocation(this.program, "viewMatrix");
				this.projMatrixLoc = this.gl.getUniformLocation(this.program, "projMatrix");
				this.shapePositionBuffer = this.gl.createBuffer();
				this.shapeColorBuffer = this.gl.createBuffer();
				this.wavePositionBuffer = this.gl.createBuffer();
				this.waveColorBuffer = this.gl.createBuffer();
			},
			update: function(sourceState, frameState) {
				this.syncCompiledScene(sourceState);
				this.rebuildGeometry(sourceState, frameState);
			},
			syncCompiledScene: function(sourceState) {
				if (this.compiledPresetVersion === sourceState.presetVersion) {
					return;
				}
				const nextScene = {
					shapes: [],
					waves: []
				};
				const preset = sourceState.presetObject;
				const shapes = preset && preset.shapes ? preset.shapes : [];
				const waves = preset && preset.waves ? preset.waves : [];
				for (let i = 0; i < shapes.length; i += 1) {
					const shapeDescriptor = compileShapeDescriptor(shapes[i], i, shapes.length);
					if (shapeDescriptor) {
						nextScene.shapes.push(shapeDescriptor);
					}
				}
				for (let i = 0; i < waves.length; i += 1) {
					const waveDescriptor = compileWaveDescriptor(waves[i], i, waves.length);
					if (waveDescriptor) {
						nextScene.waves.push(waveDescriptor);
					}
				}
				this.compiledScene = nextScene;
				this.compiledPresetVersion = sourceState.presetVersion;
			},
			rebuildGeometry: function(sourceState, frameState) {
				const audioMetrics = sourceState.audioMetrics || defaultAudioMetrics;
				const basis = extractHeadBasis(frameState);
				const stageDistance = stageConfig.distance + audioMetrics.bass * 1.2;
				const stageWidth = stageConfig.width + audioMetrics.level * 1.6;
				const stageHeight = stageConfig.height + audioMetrics.transient * 1.2;
				const stageCenter = addScaledVec3(basis.position, basis.forward, stageDistance);
				const shapePositions = [];
				const shapeColors = [];
				const wavePositions = [];
				const waveColors = [];
				const shapes = this.compiledScene.shapes;
				const waves = this.compiledScene.waves;

				for (let i = 0; i < shapes.length; i += 1) {
					const shape = shapes[i];
					const center = addBasisOffset(
						stageCenter,
						basis.right,
						basis.up,
						basis.forward,
						(shape.centerX - 0.5) * stageWidth,
						(0.5 - shape.centerY) * stageHeight,
						shape.depthOffset + audioMetrics.transient * 0.6
					);
					const radius = Math.max(0.12, shape.radius * (1.6 + audioMetrics.level * 0.9));
					const angleOffset = shape.angle + frameState.timeSeconds * (0.08 + shape.index * 0.03);
					for (let side = 0; side < shape.sides; side += 1) {
						const angleA = angleOffset + side / shape.sides * Math.PI * 2;
						const angleB = angleOffset + (side + 1) / shape.sides * Math.PI * 2;
						const pointA = addBasisOffset(center, basis.right, basis.up, basis.forward, Math.cos(angleA) * radius, Math.sin(angleA) * radius, Math.sin(angleA * 1.7 + frameState.timeSeconds) * 0.08);
						const pointB = addBasisOffset(center, basis.right, basis.up, basis.forward, Math.cos(angleB) * radius, Math.sin(angleB) * radius, Math.sin(angleB * 1.7 + frameState.timeSeconds) * 0.08);
						pushVec3(shapePositions, center.x, center.y, center.z);
						pushVec3(shapePositions, pointA.x, pointA.y, pointA.z);
						pushVec3(shapePositions, pointB.x, pointB.y, pointB.z);
						pushVec4(shapeColors, shape.centerColor[0], shape.centerColor[1], shape.centerColor[2], Math.max(0.04, shape.centerColor[3] * 0.8));
						pushVec4(shapeColors, shape.edgeColor[0], shape.edgeColor[1], shape.edgeColor[2], Math.max(0.08, shape.edgeColor[3]));
						pushVec4(shapeColors, shape.edgeColor[0], shape.edgeColor[1], shape.edgeColor[2], Math.max(0.08, shape.edgeColor[3]));
					}
				}

				for (let i = 0; i < waves.length; i += 1) {
					const wave = waves[i];
					const waveCenter = addBasisOffset(
						stageCenter,
						basis.right,
						basis.up,
						basis.forward,
						0,
						(0.5 - i / Math.max(1, waves.length - 1 || 1)) * stageHeight * 0.65,
						wave.depthOffset
					);
					const amplitude = (0.12 + wave.scaling * 0.18) * (1 + audioMetrics.bass * 1.8);
					const depthAmplitude = 0.18 + audioMetrics.transient * 0.5 + (wave.additive ? 0.1 : 0);
					const frequency = 2 + wave.index * 0.65 + (wave.spectrum ? 1.4 : 0.3);
					let previousPoint = null;
					let previousColor = null;
					for (let sampleIndex = 0; sampleIndex < wave.sampleCount; sampleIndex += 1) {
						const t = sampleIndex / Math.max(1, wave.sampleCount - 1);
						const localX = (t - 0.5) * stageWidth * 0.9;
						const wavePhase = t * Math.PI * 2 * frequency + frameState.timeSeconds * (0.7 + wave.index * 0.23);
						const localY = Math.sin(wavePhase) * amplitude + Math.cos(wavePhase * 0.37) * amplitude * 0.35;
						const localZ = Math.cos(wavePhase * 0.83 + wave.index * 0.5) * depthAmplitude;
						const point = addBasisOffset(waveCenter, basis.right, basis.up, basis.forward, localX, localY, localZ);
						const sampleColor = mixColor(wave.baseColor, [1, 1, 1, wave.baseColor[3]], 0.25 + 0.35 * Math.sin(t * Math.PI));
						if (previousPoint) {
							pushVec3(wavePositions, previousPoint.x, previousPoint.y, previousPoint.z);
							pushVec3(wavePositions, point.x, point.y, point.z);
							pushVec4(waveColors, previousColor[0], previousColor[1], previousColor[2], previousColor[3]);
							pushVec4(waveColors, sampleColor[0], sampleColor[1], sampleColor[2], sampleColor[3]);
						}
						previousPoint = point;
						previousColor = sampleColor;
					}
				}

				this.shapeVertexCount = shapePositions.length / 3;
				this.waveVertexCount = wavePositions.length / 3;
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shapePositionBuffer);
				this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(shapePositions), this.gl.DYNAMIC_DRAW);
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shapeColorBuffer);
				this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(shapeColors), this.gl.DYNAMIC_DRAW);
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.wavePositionBuffer);
				this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(wavePositions), this.gl.DYNAMIC_DRAW);
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waveColorBuffer);
				this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(waveColors), this.gl.DYNAMIC_DRAW);
			},
			drawWorld: function(sourceState, frameState) {
				if (!this.shapeVertexCount && !this.waveVertexCount) {
					return;
				}
				this.gl.useProgram(this.program);
				this.gl.uniformMatrix4fv(this.viewMatrixLoc, false, frameState.viewMatrix);
				this.gl.uniformMatrix4fv(this.projMatrixLoc, false, frameState.projMatrix);
				this.gl.enable(this.gl.DEPTH_TEST);
				this.gl.disable(this.gl.CULL_FACE);
				this.gl.enable(this.gl.BLEND);
				this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
				if (this.shapeVertexCount) {
					this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shapePositionBuffer);
					this.gl.enableVertexAttribArray(this.positionLoc);
					this.gl.vertexAttribPointer(this.positionLoc, 3, this.gl.FLOAT, false, 0, 0);
					this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shapeColorBuffer);
					this.gl.enableVertexAttribArray(this.colorLoc);
					this.gl.vertexAttribPointer(this.colorLoc, 4, this.gl.FLOAT, false, 0, 0);
					this.gl.drawArrays(this.gl.TRIANGLES, 0, this.shapeVertexCount);
				}
				if (this.waveVertexCount) {
					this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.wavePositionBuffer);
					this.gl.enableVertexAttribArray(this.positionLoc);
					this.gl.vertexAttribPointer(this.positionLoc, 3, this.gl.FLOAT, false, 0, 0);
					this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waveColorBuffer);
					this.gl.enableVertexAttribArray(this.colorLoc);
					this.gl.vertexAttribPointer(this.colorLoc, 4, this.gl.FLOAT, false, 0, 0);
					this.gl.drawArrays(this.gl.LINES, 0, this.waveVertexCount);
				}
				this.gl.disable(this.gl.BLEND);
				this.gl.enable(this.gl.CULL_FACE);
			},
			onPresetChanged: function() {
				this.compiledPresetVersion = -1;
				this.compiledScene = {
					shapes: [],
					waves: []
				};
				this.shapeVertexCount = 0;
				this.waveVertexCount = 0;
			}
		};
	});
})();
