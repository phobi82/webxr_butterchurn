(function() {
	// Generates the moving world-light presets used by the floor, boxes, and GLB props.
	const utils = window.xrVisualizerUtils;
	const clampNumber = utils.clampNumber;
	const hslToRgb = utils.hslToRgb;
	const wrapUnit = utils.wrapUnit;
	const maxDirectionalLights = 4;

	const normalizeVec3 = function(x, y, z) {
		const length = Math.sqrt(x * x + y * y + z * z) || 1;
		return {x: x / length, y: y / length, z: z / length};
	};

	const createEmptyLightingState = function() {
		return {
			ambientColor: new Float32Array([1, 1, 1]),
			ambientStrength: 0.3,
			lightDirections: new Float32Array(maxDirectionalLights * 3),
			lightColors: new Float32Array(maxDirectionalLights * 3),
			lightStrengths: new Float32Array(maxDirectionalLights),
			name: "",
			description: ""
		};
	};

	const clearLightingState = function(state) {
		state.ambientColor[0] = 1;
		state.ambientColor[1] = 1;
		state.ambientColor[2] = 1;
		state.ambientStrength = 0.3;
		state.lightDirections.fill(0);
		state.lightColors.fill(0);
		state.lightStrengths.fill(0);
	};

	const setDirectionalLight = function(state, index, direction, color, strength) {
		if (index < 0 || index >= maxDirectionalLights) {
			return;
		}
		const baseOffset = index * 3;
		state.lightDirections[baseOffset] = direction.x;
		state.lightDirections[baseOffset + 1] = direction.y;
		state.lightDirections[baseOffset + 2] = direction.z;
		state.lightColors[baseOffset] = color[0];
		state.lightColors[baseOffset + 1] = color[1];
		state.lightColors[baseOffset + 2] = color[2];
		state.lightStrengths[index] = Math.max(0, strength);
	};

	const createTopLightDirection = function(azimuth, height, ellipseX, ellipseZ) {
		return normalizeVec3(Math.cos(azimuth) * ellipseX, height, Math.sin(azimuth) * ellipseZ);
	};

	const lightingPresetDefinitions = [
		{
			name: "Aurora Drift",
			description: "Slow colorful overhead drift",
			buildState: function(state, timeSeconds, audioMetrics) {
				const level = clampNumber(audioMetrics.level || 0, 0, 1);
				const bass = clampNumber(audioMetrics.bass || 0, 0, 1);
				const transient = clampNumber(audioMetrics.transient || 0, 0, 1);
				const beatPulse = clampNumber(audioMetrics.beatPulse || 0, 0, 1);
				const pulse = clampNumber(level * 0.32 + bass * 0.5 + beatPulse * 0.7, 0, 1);
				const accentPulse = clampNumber(transient * 0.8 + beatPulse * 0.5, 0, 1);
				const ambientColor = hslToRgb(wrapUnit(0.58 + timeSeconds * 0.008), 0.45, 0.62);
				state.ambientColor[0] = ambientColor[0];
				state.ambientColor[1] = ambientColor[1];
				state.ambientColor[2] = ambientColor[2];
				state.ambientStrength = 0.32 + pulse * 0.16;
				setDirectionalLight(
					state,
					0,
					createTopLightDirection(timeSeconds * 0.18, 1.05, 0.62, 0.48),
					hslToRgb(wrapUnit(0.04 + bass * 0.02), 0.88, 0.62),
					0.34 + bass * 0.42 + beatPulse * 0.16
				);
				setDirectionalLight(
					state,
					1,
					createTopLightDirection(timeSeconds * 0.13 + 2.2, 1.12, 0.54, 0.66),
					hslToRgb(wrapUnit(0.56 + timeSeconds * 0.01), 0.82, 0.6),
					0.28 + level * 0.24 + accentPulse * 0.14
				);
				setDirectionalLight(
					state,
					2,
					createTopLightDirection(-(timeSeconds * 0.11) + 4.1, 0.96, 0.7, 0.52),
					hslToRgb(wrapUnit(0.34 + bass * 0.015), 0.78, 0.55),
					0.24 + pulse * 0.22 + transient * 0.18
				);
				setDirectionalLight(
					state,
					3,
					createTopLightDirection(timeSeconds * 0.21 + 1.1, 1.18, 0.46, 0.74),
					hslToRgb(wrapUnit(0.82 + transient * 0.03), 0.74, 0.64),
					0.18 + transient * 0.34 + beatPulse * 0.18
				);
			}
		},
		{
			name: "Disco Storm",
			description: "Fast strobing overhead disco",
			buildState: function(state, timeSeconds, audioMetrics) {
				const level = clampNumber(audioMetrics.level || 0, 0, 1);
				const bass = clampNumber(audioMetrics.bass || 0, 0, 1);
				const transient = clampNumber(audioMetrics.transient || 0, 0, 1);
				const beatPulse = clampNumber(audioMetrics.beatPulse || 0, 0, 1);
				const strobe = clampNumber(transient * 1.15 + beatPulse * 0.95 + Math.max(0, Math.sin(timeSeconds * 18.5)) * 0.28, 0, 1.4);
				const sweep = wrapUnit(timeSeconds * (0.18 + bass * 0.18));
				const ambientColor = hslToRgb(wrapUnit(0.96 + sweep), 0.9, 0.56);
				state.ambientColor[0] = ambientColor[0];
				state.ambientColor[1] = ambientColor[1];
				state.ambientColor[2] = ambientColor[2];
				state.ambientStrength = 0.12 + level * 0.08 + beatPulse * 0.05;
				setDirectionalLight(
					state,
					0,
					createTopLightDirection(timeSeconds * 0.82 + bass * 0.8, 1.08, 0.88, 0.34),
					hslToRgb(wrapUnit(sweep + 0.02), 0.98, 0.6),
					0.28 + strobe * 0.9
				);
				setDirectionalLight(
					state,
					1,
					createTopLightDirection(-(timeSeconds * 0.91) + 1.9, 1.16, 0.42, 0.92),
					hslToRgb(wrapUnit(sweep + 0.28), 0.96, 0.58),
					0.22 + bass * 0.2 + strobe * 0.82
				);
				setDirectionalLight(
					state,
					2,
					createTopLightDirection(timeSeconds * 1.14 + 4.0, 0.98, 0.96, 0.46),
					hslToRgb(wrapUnit(sweep + 0.54), 0.98, 0.6),
					0.2 + transient * 0.25 + strobe * 0.95
				);
				setDirectionalLight(
					state,
					3,
					createTopLightDirection(-(timeSeconds * 0.74) + 5.4, 1.22, 0.52, 0.98),
					hslToRgb(wrapUnit(sweep + 0.8), 0.94, 0.62),
					0.24 + level * 0.16 + beatPulse * 0.12 + strobe * 0.88
				);
			}
		}
	];

	window.xrSceneLighting = {
		MAX_DIRECTIONAL_LIGHTS: maxDirectionalLights
	};

	window.getSceneLightingUniformLocations = function(gl, program) {
		return {
			ambientColorLoc: gl.getUniformLocation(program, "ambientColor"),
			ambientStrengthLoc: gl.getUniformLocation(program, "ambientStrength"),
			lightDirectionsLoc: gl.getUniformLocation(program, "lightDirections[0]"),
			lightColorsLoc: gl.getUniformLocation(program, "lightColors[0]"),
			lightStrengthsLoc: gl.getUniformLocation(program, "lightStrengths[0]")
		};
	};

	window.applySceneLightingUniforms = function(gl, uniformLocations, lightingState) {
		if (!uniformLocations || !lightingState) {
			return;
		}
		gl.uniform3fv(uniformLocations.ambientColorLoc, lightingState.ambientColor);
		gl.uniform1f(uniformLocations.ambientStrengthLoc, lightingState.ambientStrength);
		gl.uniform3fv(uniformLocations.lightDirectionsLoc, lightingState.lightDirections);
		gl.uniform3fv(uniformLocations.lightColorsLoc, lightingState.lightColors);
		gl.uniform1fv(uniformLocations.lightStrengthsLoc, lightingState.lightStrengths);
	};

	window.createSceneLightingController = function() {
		const state = createEmptyLightingState();
		let currentPresetIndex = 0;
		const getPresetNames = function() {
			const names = [];
			for (let i = 0; i < lightingPresetDefinitions.length; i += 1) {
				names.push(lightingPresetDefinitions[i].name);
			}
			return names;
		};
		return {
			update: function(timeSeconds, audioMetrics) {
				const preset = lightingPresetDefinitions[currentPresetIndex] || lightingPresetDefinitions[0];
				clearLightingState(state);
				preset.buildState(state, timeSeconds || 0, audioMetrics || {});
				state.name = preset.name;
				state.description = preset.description;
				return state;
			},
			getState: function() {
				return state;
			},
			getSelectionState: function() {
				return {
					presetNames: getPresetNames(),
					currentPresetIndex: currentPresetIndex,
					currentPresetDescription: lightingPresetDefinitions[currentPresetIndex] ? lightingPresetDefinitions[currentPresetIndex].description : ""
				};
			},
			selectPreset: function(index) {
				if (!lightingPresetDefinitions.length) {
					return Promise.resolve();
				}
				currentPresetIndex = (index + lightingPresetDefinitions.length) % lightingPresetDefinitions.length;
				return Promise.resolve();
			}
		};
	};
})();
