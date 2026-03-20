const getPassthroughUiState = function(args) {
	args = args || {};
	if (args.availableBool) {
		return {
			availableBool: true,
			fallbackBool: false,
			statusText: "Live headset passthrough active"
		};
	}
	if (args.sessionMode === "immersive-vr") {
		return {
			availableBool: false,
			fallbackBool: true,
			statusText: "No passthrough here, using black fallback"
		};
	}
	if (args.sessionMode === "immersive-ar") {
		return {
			availableBool: false,
			fallbackBool: true,
			statusText: args.environmentBlendMode === "opaque" ? "AR session is opaque, using black fallback" : "Passthrough unavailable, using black fallback"
		};
	}
	if (args.supportedBool) {
		return {
			availableBool: false,
			fallbackBool: true,
			statusText: "AR not active, using black fallback"
		};
	}
	return {
		availableBool: false,
		fallbackBool: true,
		statusText: "Passthrough unsupported, using black fallback"
	};
};

const syncPassthroughBackgroundBlend = function(visualizerEngine, passthroughMix) {
	if (visualizerEngine && visualizerEngine.setBackgroundBlend) {
		visualizerEngine.setBackgroundBlend(passthroughMix, true);
	}
};

const createPassthroughOverlayRenderer = function(options) {
	let gl = null;
	let program = null;
	let positionLoc = null;
	let colorLoc = null;
	let alphaLoc = null;
	let buffer = null;
	const tintVec3 = new Float32Array(3);

	const getOverlayState = function(args, passthroughMix) {
		if (passthroughMix <= 0.001) {
			return null;
		}
		const lightingState = args.sceneLighting && args.sceneLighting.getState ? args.sceneLighting.getState() : null;
		const audioMetrics = args.menuContentState && args.menuContentState.audioMetrics ? args.menuContentState.audioMetrics : {};
		let tintR = 1;
		let tintG = 1;
		let tintB = 1;
		if (lightingState) {
			tintR = lightingState.ambientColor[0] * lightingState.ambientStrength * 0.75;
			tintG = lightingState.ambientColor[1] * lightingState.ambientStrength * 0.75;
			tintB = lightingState.ambientColor[2] * lightingState.ambientStrength * 0.75;
			let totalWeight = lightingState.ambientStrength * 0.75;
			for (let i = 0; i < lightingState.lightStrengths.length; i += 1) {
				const strength = Math.max(0, lightingState.lightStrengths[i] || 0);
				if (strength <= 0.0001) {
					continue;
				}
				const colorOffset = i * 3;
				tintR += lightingState.lightColors[colorOffset] * strength;
				tintG += lightingState.lightColors[colorOffset + 1] * strength;
				tintB += lightingState.lightColors[colorOffset + 2] * strength;
				totalWeight += strength;
			}
			if (totalWeight > 0.0001) {
				tintR /= totalWeight;
				tintG /= totalWeight;
				tintB /= totalWeight;
			}
		}
		const tintDrive = options.clampNumber(
			(audioMetrics.level || 0) * 0.24 +
			(audioMetrics.bass || 0) * 0.3 +
			(audioMetrics.transient || 0) * 0.34 +
			(audioMetrics.beatPulse || 0) * 0.42,
			0,
			1
		);
		const tintStrength = options.clampNumber(tintDrive * passthroughMix * 0.9, 0, 0.9);
		return {
			alpha: 0.5,
			color: [
				options.clampNumber(tintR * tintStrength, 0, 1),
				options.clampNumber(tintG * tintStrength, 0, 1),
				options.clampNumber(tintB * tintStrength, 0, 1)
			]
		};
	};

	return {
		init: function(glContext) {
			gl = glContext;
			program = createProgram(gl, "attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}", "precision mediump float;uniform vec3 color;uniform float alpha;void main(){gl_FragColor=vec4(color,alpha);}", "Passthrough overlay");
			positionLoc = gl.getAttribLocation(program, "position");
			colorLoc = gl.getUniformLocation(program, "color");
			alphaLoc = gl.getUniformLocation(program, "alpha");
			buffer = createFullscreenTriangleBuffer(gl);
		},
		draw: function(args, passthroughMix) {
			const overlayState = getOverlayState(args, passthroughMix);
			if (!overlayState) {
				return;
			}
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.useProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(positionLoc);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
			tintVec3[0] = overlayState.color[0];
			tintVec3[1] = overlayState.color[1];
			tintVec3[2] = overlayState.color[2];
			gl.uniform3fv(colorLoc, tintVec3);
			gl.uniform1f(alphaLoc, overlayState.alpha);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
	};
};
