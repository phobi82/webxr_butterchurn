// Pure passthrough mode catalog and blend formulas.
const passthroughBlendModeDefinitions = [
	{key: "uniform", label: "Uniform"},
	{key: "flashlight", label: "Flashlight"}
];

const passthroughLightingModeDefinitions = [
	{key: "none", label: "None"},
	{key: "uniform", label: "Uniform"},
	{key: "spots", label: "Spots"},
	{key: "club", label: "Club"}
];

const passthroughUniformBlendModeDefinitions = [
	{key: "manual", label: "Manual"},
	{key: "audioReactive", label: "Music"}
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
	if (state.blendModeKey !== "uniform") {
		return 0;
	}
	if (state.uniformBlendModeKey === "audioReactive") {
		const directionMix = clampNumber(Math.abs(state.audioReactiveIntensity), 0, 1);
		const reactiveDrive = getReactivePassthroughDrive(audioDrive);
		const targetShare = state.audioReactiveIntensity >= 0 ? reactiveDrive : 1 - reactiveDrive;
		return clampNumber(0.5 + (targetShare - 0.5) * directionMix, 0, 1);
	}
	return clampNumber(state.manualMix, 0, 1);
};

const getPassthroughControlDefinitions = function(state) {
	if (state.blendModeKey === "flashlight") {
		return {
			controls: [
				{
					key: "flashlightRadius",
					label: "Radius",
					value: state.flashlightRadius,
					min: 0.05,
					max: 0.45,
					minLabel: "Tight",
					maxLabel: "Wide"
				},
				{
					key: "flashlightSoftness",
					label: "Softness",
					value: state.flashlightSoftness,
					min: 0.01,
					max: 0.35,
					minLabel: "Hard",
					maxLabel: "Soft"
				}
			],
			uniformBlendModeVisibleBool: false
		};
	}
	if (state.uniformBlendModeKey === "audioReactive") {
		return {
			controls: [
				{
					key: "audioReactiveIntensity",
					label: "Intensity",
					value: state.audioReactiveIntensity,
					min: -1,
					max: 1,
					minLabel: "Vis -> Passthrough",
					maxLabel: "Passthrough -> Vis"
				}
			],
			uniformBlendModeVisibleBool: true
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
				minLabel: "Butterchurn",
				maxLabel: "Passthrough"
			}
		],
		uniformBlendModeVisibleBool: true
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
				key: "effectTintShare",
				label: "Tint",
				value: state.effectTintShare == null ? 1 : state.effectTintShare,
				min: 0,
				max: 1,
				minLabel: "Off",
				maxLabel: "Full"
			},
			{
				key: "effectRevealShare",
				label: "Reveal",
				value: state.effectRevealShare == null ? 1 : state.effectRevealShare,
				min: 0,
				max: 1,
				minLabel: "Off",
				maxLabel: "Full"
			}
		] : []
	};
};
