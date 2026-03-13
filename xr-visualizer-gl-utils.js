(function() {
	const fullscreenVertexSource = [
		"attribute vec2 position;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");

	const createShader = function(gl, type, source, errorLabel) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error(gl.getShaderInfoLog(shader) || errorLabel + " shader compile failed");
		}
		return shader;
	};

	const createProgram = function(gl, vertexSource, fragmentSource, errorLabel) {
		const program = gl.createProgram();
		gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource, errorLabel));
		gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, errorLabel));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) || errorLabel + " program link failed");
		}
		return program;
	};

	const createFullscreenProgramInfo = function(gl, fragmentSource, includeAudioUniformsBool, errorLabel) {
		const program = createProgram(gl, fullscreenVertexSource, fragmentSource, errorLabel);
		return {
			program: program,
			positionLoc: gl.getAttribLocation(program, "position"),
			sourceTextureLoc: gl.getUniformLocation(program, "sourceTexture"),
			viewportSizeLoc: gl.getUniformLocation(program, "viewportSize"),
			eyeCenterOffsetLoc: gl.getUniformLocation(program, "eyeCenterOffset"),
			orientationOffsetLoc: gl.getUniformLocation(program, "orientationOffset"),
			audioMetricsLoc: includeAudioUniformsBool ? gl.getUniformLocation(program, "audioMetrics") : null,
			beatPulseLoc: includeAudioUniformsBool ? gl.getUniformLocation(program, "beatPulse") : null
		};
	};

	const createFullscreenTriangleBuffer = function(gl) {
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			-1, -1,
			3, -1,
			-1, 3
		]), gl.STATIC_DRAW);
		return buffer;
	};

	window.xrVisualizerGlUtils = {
		fullscreenVertexSource: fullscreenVertexSource,
		createShader: createShader,
		createProgram: createProgram,
		createFullscreenProgramInfo: createFullscreenProgramInfo,
		createFullscreenTriangleBuffer: createFullscreenTriangleBuffer
	};
})();
