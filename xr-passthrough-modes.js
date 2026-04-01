// Mode catalogs and control definitions for Background, Passthrough and Lighting axes.
const backgroundMixModeDefinitions = [
	{key: "manual", label: "manual"},
	{key: "audioReactive", label: "sound-reactive"}
];

const passthroughLightingModeDefinitions = [
	{key: "none", label: "None"},
	{key: "uniform", label: "Uniform"},
	{key: "spots", label: "Spots"},
	{key: "club", label: "Club"}
];

const passthroughDepthModeDefinitions = [
	{key: "distance", label: "Distance"},
	{key: "echo", label: "Echo"}
];

const passthroughDepthReconstructionModeDefinitions = [
	{key: "raw", label: "Raw"},
	{key: "edgeAware", label: "Edge-aware"},
	{key: "heightmap", label: "Heightmap"}
];

const findModeIndexByKey = function(definitions, key) {
	for (let i = 0; i < definitions.length; i += 1) {
		if (definitions[i].key === key) {
			return i;
		}
	}
	return -1;
};

const cycleModeKey = function(definitions, currentKey, direction) {
	const currentIndex = findModeIndexByKey(definitions, currentKey);
	const safeIndex = currentIndex >= 0 ? currentIndex : 0;
	return definitions[(safeIndex + definitions.length + direction) % definitions.length].key;
};

const getReactivePassthroughDrive = function(audioDrive) {
	const clampedDrive = clampNumber(audioDrive, 0, 1);
	return clampNumber(Math.pow(clampedDrive, 0.55) * 1.3, 0, 1);
};

const getPassthroughVisibleShare = function(state, audioDrive) {
	if (state.mixModeKey === "audioReactive") {
		const directionMix = clampNumber(Math.abs(state.audioReactiveIntensity), 0, 1);
		const reactiveDrive = getReactivePassthroughDrive(audioDrive);
		const targetShare = state.audioReactiveIntensity >= 0 ? reactiveDrive : 1 - reactiveDrive;
		return clampNumber(0.5 + (targetShare - 0.5) * directionMix, 0, 1);
	}
	return clampNumber(state.manualMix, 0, 1);
};

const getBackgroundControlDefinitions = function(state) {
	if (state.mixModeKey === "audioReactive") {
		return {
			controls: [
				{
					key: "audioReactiveIntensity",
					label: "Intensity",
					value: state.audioReactiveIntensity,
					min: -1,
					max: 1,
					minLabel: "Vis -> Mod. Reality",
					maxLabel: "Mod. Reality -> Vis"
				}
			],
			mixModeVisibleBool: true
		};
	}
	return {
		controls: [
			{
				key: "manualMix",
				label: "Mix",
				value: state.manualMix,
				min: 0,
				max: 1,
				minLabel: "Visualizer",
				maxLabel: "Modified Reality"
			}
		],
		mixModeVisibleBool: true
	};
};

const getPassthroughControlDefinitions = function(state) {
	var controls = [];
	var distanceReactiveControl = null;
	var echoReactiveControls = [];
	var echoReactiveIntensityVisibleBool = false;
	if (state.flashlightActiveBool) {
		controls.push(
			{key: "flashlightRadius", label: "Radius", value: state.flashlightRadius, min: 0.05, max: 0.45, minLabel: "Tight", maxLabel: "Wide"},
			{key: "flashlightSoftness", label: "Softness", value: state.flashlightSoftness, min: 0.01, max: 0.35, minLabel: "Hard", maxLabel: "Soft"}
		);
	}
	if (state.depthActiveBool) {
		if (state.depthModeKey === "echo") {
			controls.push(
				{key: "depthEchoPhase", label: "Phase", value: state.depthEchoPhase, min: 0, max: Math.max(0.1, state.depthEchoWavelength), minLabel: "0m", maxLabel: state.depthEchoWavelength.toFixed(1) + "m", valueText: state.depthEchoPhase.toFixed(1) + "m"},
				{key: "depthEchoPhaseSpeed", label: "Phase-Speed", value: state.depthEchoPhaseSpeed, min: -10, max: 10, minLabel: "-10m/s", maxLabel: "10m/s", valueText: state.depthEchoPhaseSpeed.toFixed(1) + "m/s"},
				{key: "depthEchoWavelength", label: "Wavelength", value: state.depthEchoWavelength, min: 0.1, max: 10, minLabel: "0.1m", maxLabel: "10m", valueText: state.depthEchoWavelength.toFixed(1) + "m"},
				{key: "depthEchoDutyCycle", label: "DutyCycle", value: state.depthEchoDutyCycle, min: 0, max: 1, minLabel: "0%", maxLabel: "100%", valueText: Math.round(state.depthEchoDutyCycle * 100) + "%"},
				{key: "depthEchoFade", label: "Fade", value: state.depthEchoFade, min: 0, max: 1, minLabel: "Hard", maxLabel: "Flow", valueText: Math.round(state.depthEchoFade * 100) + "%"}
			);
			echoReactiveControls.push(
				{key: "depthEchoPhaseReactive", label: "Phase", checkedBool: !!state.depthEchoPhaseReactiveBool},
				{key: "depthEchoDutyCycleReactive", label: "DutyCycle", checkedBool: !!state.depthEchoDutyCycleReactiveBool}
			);
			echoReactiveIntensityVisibleBool = !!(
				state.depthEchoPhaseReactiveBool ||
				state.depthEchoPhaseSpeedReactiveBool ||
				state.depthEchoWavelengthReactiveBool ||
				state.depthEchoDutyCycleReactiveBool ||
				state.depthEchoFadeReactiveBool
			);
			if (echoReactiveIntensityVisibleBool) {
				controls.push({
					key: "depthEchoReactiveIntensity",
					label: "Intensity",
					value: state.depthEchoReactiveIntensity,
					min: -1,
					max: 1,
					minLabel: "-100%",
					maxLabel: "100%",
					valueText: Math.round(state.depthEchoReactiveIntensity * 100) + "%"
				});
			}
		} else {
			distanceReactiveControl = {
				key: "depthDistanceReactiveToggle",
				label: "Sound-reactive",
				checkedBool: !!state.depthDistanceReactiveBool
			};
			if (state.depthDistanceReactiveBool) {
				controls.push({
					key: "depthDistanceReactiveIntensity",
					label: "Intensity",
					value: state.depthDistanceReactiveIntensity,
					min: -1,
					max: 1,
					minLabel: "-100%",
					maxLabel: "100%",
					valueText: Math.round(state.depthDistanceReactiveIntensity * 100) + "%"
				});
			}
			controls.push(
				{key: "depthThreshold", label: "Distance", value: state.depthThreshold, min: 0, max: 8, minLabel: "0m", maxLabel: "Far", valueText: state.depthThreshold.toFixed(2) + "m"},
				{key: "depthFade", label: "Fade", value: state.depthFade, min: 0, max: 2, minLabel: "Hard", maxLabel: "Soft", valueText: state.depthFade.toFixed(2) + "m"}
			);
		}
		controls.push(
			{key: "depthMrRetain", label: "MR Blend", value: state.depthMrRetain, min: 0, max: 1, minLabel: "Passthrough", maxLabel: "Mod. Reality", valueText: Math.round(state.depthMrRetain * 100) + "%"}
		);
	}
	return {
		controls: controls,
		distanceReactiveControl: distanceReactiveControl,
		echoReactiveControls: echoReactiveControls,
		echoReactiveIntensityVisibleBool: echoReactiveIntensityVisibleBool
	};
};

const getPassthroughLightingControlDefinitions = function(state) {
	if (state.lightingModeKey === "none") {
		return {
			controls: [],
			effectSemanticControls: []
		};
	}
	const effectSemanticControlsVisibleBool = state.lightingModeKey === "club" || state.lightingModeKey === "spots";
	return {
		controls: [
			{
				key: "lightingDarkness",
				label: "Darkness",
				value: state.lightingDarkness == null ? 0.05 : state.lightingDarkness,
				min: 0,
				max: 1,
				minLabel: "Lights Only",
				maxLabel: "Additive"
			}
		],
		effectSemanticControls: effectSemanticControlsVisibleBool ? [
			{
				key: "effectAdditiveShare",
				label: "Additive",
				value: state.effectAdditiveShare == null ? 1 : state.effectAdditiveShare,
				min: 0,
				max: 1,
				minLabel: "Off",
				maxLabel: "Full"
			},
			{
				key: "effectAlphaBlendShare",
				label: "Alpha Blend",
				value: state.effectAlphaBlendShare == null ? 1 : state.effectAlphaBlendShare,
				min: 0,
				max: 1,
				minLabel: "Off",
				maxLabel: "Full"
			}
		] : []
	};
};
