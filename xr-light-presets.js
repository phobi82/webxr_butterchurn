// Extend this file with more preset functions and register them below.

const auroraDrift = function(state, timeSeconds, audioMetrics) {
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
	setDirectionalLight(state, 0, createTopLightDirection(timeSeconds * 0.18, 1.05, 0.62, 0.48), hslToRgb(wrapUnit(0.04 + bass * 0.02), 0.88, 0.62), 0.34 + bass * 0.42 + beatPulse * 0.16);
	setDirectionalLight(state, 1, createTopLightDirection(timeSeconds * 0.13 + 2.2, 1.12, 0.54, 0.66), hslToRgb(wrapUnit(0.56 + timeSeconds * 0.01), 0.82, 0.6), 0.28 + level * 0.24 + accentPulse * 0.14);
	setDirectionalLight(state, 2, createTopLightDirection(-(timeSeconds * 0.11) + 4.1, 0.96, 0.7, 0.52), hslToRgb(wrapUnit(0.34 + bass * 0.015), 0.78, 0.55), 0.24 + pulse * 0.22 + transient * 0.18);
	setDirectionalLight(state, 3, createTopLightDirection(timeSeconds * 0.21 + 1.1, 1.18, 0.46, 0.74), hslToRgb(wrapUnit(0.82 + transient * 0.03), 0.74, 0.64), 0.18 + transient * 0.34 + beatPulse * 0.18);
};

const discoStorm = function(state, timeSeconds, audioMetrics) {
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
	setDirectionalLight(state, 0, createTopLightDirection(timeSeconds * 0.82 + bass * 0.8, 1.08, 0.88, 0.34), hslToRgb(wrapUnit(sweep + 0.02), 0.98, 0.6), 0.28 + strobe * 0.9);
	setDirectionalLight(state, 1, createTopLightDirection(-(timeSeconds * 0.91) + 1.9, 1.16, 0.42, 0.92), hslToRgb(wrapUnit(sweep + 0.28), 0.96, 0.58), 0.22 + bass * 0.2 + strobe * 0.82);
	setDirectionalLight(state, 2, createTopLightDirection(timeSeconds * 1.14 + 4.0, 0.98, 0.96, 0.46), hslToRgb(wrapUnit(sweep + 0.54), 0.98, 0.6), 0.2 + transient * 0.25 + strobe * 0.95);
	setDirectionalLight(state, 3, createTopLightDirection(-(timeSeconds * 0.74) + 5.4, 1.22, 0.52, 0.98), hslToRgb(wrapUnit(sweep + 0.8), 0.94, 0.62), 0.24 + level * 0.16 + beatPulse * 0.12 + strobe * 0.88);
};

const lightingPresetDefinitions = [
	{
		name: formatFunctionLabel(auroraDrift.name),
		description: "Slow colorful overhead drift",
		buildState: auroraDrift
	},
	{
		name: formatFunctionLabel(discoStorm.name),
		description: "Fast strobing overhead disco",
		buildState: discoStorm
	}
];
