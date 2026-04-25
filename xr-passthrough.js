// Passthrough policy, modes, and overlay state.

// Modes
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

const passthroughLightingAnchorModeDefinitions = [
	{key: "auto", label: "Auto"},
	{key: "vrWorld", label: "VR World"},
	{key: "realWorld", label: "Real World"}
];

const passthroughDepthModeDefinitions = [
	{key: "distance", label: "Distance"},
	{key: "echo", label: "Echo"},
	{key: "diagnostic", label: "Diagnostic"}
];

const passthroughDepthDiagnosticPaletteDefinitions = [
	{key: "rainbow", label: "Rainbow"},
	{key: "grayscale", label: "Grayscale"},
	{key: "bands", label: "Bands"}
];

const passthroughDepthDiagnosticViewDefinitions = [
	{key: "source", label: "Source"},
	{key: "processed", label: "Processed"}
];

const passthroughDepthDiagnosticSourceDefinitions = [
	{key: "gpu", label: "GPU"},
	{key: "cpu", label: "CPU"}
];

const passthroughDepthDiagnosticTypeDefinitions = [
	{key: "smooth", label: "Smooth"},
	{key: "raw", label: "Raw"}
];

const passthroughDepthDiagnosticFormatDefinitions = [
	{key: "luminance-alpha", label: "LumAlpha"},
	{key: "float32", label: "Float32"},
	{key: "unsigned-short", label: "UShort"}
];

const formatPassthroughPercentText = function(value) {
	return Math.round(value * 100) + "%";
};

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
		const intensity = state.sliders.audioReactiveIntensity.value;
		const directionMix = Math.abs(intensity);
		const reactiveDrive = getReactivePassthroughDrive(audioDrive);
		const targetShare = intensity >= 0 ? reactiveDrive : 1 - reactiveDrive;
		return clampNumber(0.5 + (targetShare - 0.5) * directionMix, 0, 1);
	}
	return state.sliders.manualMix.value;
};

const getBackgroundControlDefinitions = function(state) {
	if (state.mixModeKey === "audioReactive") {
		return {
			controls: [state.sliders.audioReactiveIntensity],
			mixModeVisibleBool: true
		};
	}
	return {
		controls: [state.sliders.manualMix],
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
			state.sliders.flashlightRadius,
			state.sliders.flashlightSoftness
		);
	}
	if (state.depthActiveBool) {
		if (state.depthModeKey === "echo") {
			controls.push(
				state.sliders.depthEchoPhase,
				state.sliders.depthEchoPhaseSpeed,
				state.sliders.depthEchoWavelength,
				state.sliders.depthEchoDutyCycle,
				state.sliders.depthEchoFade
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
				controls.push(state.sliders.depthEchoReactiveIntensity);
			}
		} else {
			if (state.depthModeKey === "distance") {
				distanceReactiveControl = {
					key: "depthDistanceReactiveToggle",
					label: "Sound-reactive",
					checkedBool: !!state.depthDistanceReactiveBool
				};
			}
			if (state.depthModeKey === "distance" && state.depthDistanceReactiveBool) {
				controls.push(state.sliders.depthDistanceReactiveIntensity);
			}
			if (state.depthModeKey === "diagnostic") {
				controls.push(state.sliders.depthDiagnosticRange);
				controls.push(state.sliders.depthDiagnosticRainbowFrequency);
			} else {
				controls.push(
					state.sliders.depthThreshold,
					state.sliders.depthFade
				);
			}
		}
		if (state.depthModeKey !== "diagnostic") {
			controls.push(state.sliders.depthMrRetain);
		}
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
		controls: [state.sliders.lightingDarkness],
		effectSemanticControls: effectSemanticControlsVisibleBool ? [
			state.sliders.effectAdditiveShare,
			state.sliders.effectAlphaBlendShare
		] : []
	};
};

// Controller
const PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT = "current";
const PASSTHROUGH_EFFECT_SEMANTIC_MODE_ADDITIVE_ONLY = "additiveOnly";
const PASSTHROUGH_EFFECT_SEMANTIC_MODE_ALPHA_BLEND_ONLY = "alphaBlendOnly";

const passthroughEffectSemanticModeDefinitions = [
	{key: PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT, label: "Current"},
	{key: PASSTHROUGH_EFFECT_SEMANTIC_MODE_ADDITIVE_ONLY, label: "Additive Only"},
	{key: PASSTHROUGH_EFFECT_SEMANTIC_MODE_ALPHA_BLEND_ONLY, label: "Alpha Blend Only"}
];

const getPassthroughEffectSemanticModeLabel = function(modeKey) {
	for (let i = 0; i < passthroughEffectSemanticModeDefinitions.length; i += 1) {
		if (passthroughEffectSemanticModeDefinitions[i].key === modeKey) {
			return passthroughEffectSemanticModeDefinitions[i].label;
		}
	}
	return "Current";
};

const getPassthroughAvailabilityState = function(args) {
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

const getWeightedAudioDrive = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return clampNumber(
		(audioMetrics.level || 0) * 0.24 +
		(audioMetrics.bass || 0) * 0.3 +
		(audioMetrics.transient || 0) * 0.28 +
		(audioMetrics.beatPulse || 0) * 0.5,
		0,
		1
	);
};

const getPassthroughBlendDrive = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return clampNumber(audioMetrics.beatPulse || 0, 0, 1);
};

const selectKnownModeKey = function(definitions, key, currentKey) {
	for (let i = 0; i < definitions.length; i += 1) {
		if (definitions[i].key === key) {
			return key;
		}
	}
	return currentKey;
};

// Runtime controller owns session state, fallback policy, and overlay assembly.
const createPassthroughController = function(options) {
	options = options || {};
	const state = {
		availableBool: false,
		fallbackBool: true,
		supportedBool: false,
		statusText: "Passthrough unsupported, using black fallback",
		mixModeKey: options.initialMixModeKey || "manual",
		flashlightActiveBool: false,
		depthActiveBool: false,
		lightingModeKey: options.initialLightingModeKey || "uniform",
		lightingAnchorModeKey: options.initialLightingAnchorModeKey || PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO,
		lightingDarkness: options.initialLightingDarkness == null ? 0.05 : options.initialLightingDarkness,
		effectSemanticModeKey: options.initialEffectSemanticModeKey || PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
		effectAdditiveShare: options.initialEffectAdditiveShare == null ? 1 : options.initialEffectAdditiveShare,
		effectAlphaBlendShare: options.initialEffectAlphaBlendShare == null ? 1 : options.initialEffectAlphaBlendShare,
		manualMix: options.initialManualMix == null ? 0 : options.initialManualMix,
		audioReactiveIntensity: options.initialAudioReactiveIntensity == null ? 0.7 : options.initialAudioReactiveIntensity,
		flashlightRadius: options.initialFlashlightRadius == null ? 0.15 : options.initialFlashlightRadius,
		flashlightSoftness: options.initialFlashlightSoftness == null ? 0.05 : options.initialFlashlightSoftness,
		depthModeKey: options.initialDepthModeKey || "distance",

		depthRadialBool: options.initialDepthRadialBool == null ? true : !!options.initialDepthRadialBool,
		depthThreshold: 0.80,
		depthFade: 0.20,
		depthDiagnosticPaletteKey: options.initialDepthDiagnosticPaletteKey || "rainbow",
		depthDiagnosticViewKey: options.initialDepthDiagnosticViewKey || "processed",
		depthDiagnosticSourceKey: options.initialDepthDiagnosticSourceKey || "gpu",
		depthDiagnosticTypeKey: options.initialDepthDiagnosticTypeKey || "smooth",
		depthDiagnosticFormatKey: options.initialDepthDiagnosticFormatKey || "unsigned-short",
		depthDiagnosticRange: options.initialDepthDiagnosticRange == null ? 6 : options.initialDepthDiagnosticRange,
		depthDiagnosticRainbowFrequency: options.initialDepthDiagnosticRainbowFrequency == null ? 2 : options.initialDepthDiagnosticRainbowFrequency,
		depthDistanceReactiveBool: false,
		depthDistanceReactiveIntensity: options.initialDepthDistanceReactiveIntensity == null ? 1 : options.initialDepthDistanceReactiveIntensity,
		depthDistanceMrRetain: 0.3,
		depthEchoPhase: 0,
		depthEchoWavelength: 3,
		depthEchoDutyCycle: 0.25,
		depthEchoFade: 1,
		depthEchoPhaseSpeed: 5,
		depthEchoReactiveIntensity: options.initialDepthEchoReactiveIntensity == null ? 1 : options.initialDepthEchoReactiveIntensity,
		depthEchoPhaseOffset: 0,
		depthEchoMrRetain: options.initialDepthEchoMrRetain == null ? 0.95 : options.initialDepthEchoMrRetain,
		depthEchoPhaseReactiveBool: false,
		depthEchoPhaseSpeedReactiveBool: false,
		depthEchoWavelengthReactiveBool: false,
		depthEchoDutyCycleReactiveBool: true,
		depthEchoFadeReactiveBool: false,
		depthMrRetain: 0,
		usableDepthAvailableBool: false,
		depthVisualMaskingEnabledBool: options.depthVisualMaskingEnabledBool == null ? true : !!options.depthVisualMaskingEnabledBool,
		smoothedAudioDrive: 0,
		smoothedBlendDrive: 0
	};

	const getDepthModeFloat = function(depthModeKey) {
		return depthModeKey === "echo" ? 1 : 0;
	};



	const getDepthMrRetainForMode = function(depthModeKey) {
		return depthModeKey === "echo" ? state.depthEchoMrRetain : state.depthDistanceMrRetain;
	};

	state.depthMrRetain = getDepthMrRetainForMode(state.depthModeKey);

	const depthRuntime = {
		quantizeDepthEchoPhaseSpeed: function(value) {
			return Math.round(value * 10) / 10;
		},
		quantizeDepthEchoWavelength: function(value) {
			return Math.round(value * 10) / 10;
		},
		wrapEchoPhase: function(phaseValue, wavelength) {
			wavelength = Math.max(0.1, wavelength || 0.1);
			return ((phaseValue % wavelength) + wavelength) % wavelength;
		},
		applyReactiveDelta: function(baseValue, reactiveValue, intensity) {
			return baseValue + (reactiveValue - baseValue) * intensity;
		},
		getEffectiveDistanceDepthState: function() {
			var effectiveThreshold = state.sliders.depthThreshold.value;
			if (state.depthDistanceReactiveBool) {
				effectiveThreshold = clampNumber(
					effectiveThreshold + (state.smoothedAudioDrive - 0.5) * 16 * state.sliders.depthDistanceReactiveIntensity.value,
					state.sliders.depthThreshold.min,
					state.sliders.depthThreshold.max
				);
			}
			return {
				depthMode: getDepthModeFloat(state.depthModeKey),
				depthThreshold: effectiveThreshold,
				depthFade: state.sliders.depthFade.value,
				depthEchoWavelength: state.sliders.depthEchoWavelength.value,
				depthEchoDutyCycle: state.sliders.depthEchoDutyCycle.value,
				depthEchoFade: state.sliders.depthEchoFade.value,
				depthPhaseOffset: depthRuntime.wrapEchoPhase(state.sliders.depthEchoPhase.value + state.depthEchoPhaseOffset, state.sliders.depthEchoWavelength.value),
				depthMrRetain: state.sliders.depthMrRetain.value,
				depthRadialBool: state.depthRadialBool
			};
		},
		getEffectiveEchoDepthState: function() {
			var effectiveWavelength = state.sliders.depthEchoWavelength.value;
			var effectiveDutyCycle = state.sliders.depthEchoDutyCycle.value;
			var effectiveFade = state.sliders.depthEchoFade.value;
			var audioDrive = clampNumber(state.smoothedAudioDrive, 0, 1);
			var reactiveIntensity = state.sliders.depthEchoReactiveIntensity.value;
			if (state.depthEchoWavelengthReactiveBool) {
				effectiveWavelength = clampNumber(
					depthRuntime.applyReactiveDelta(effectiveWavelength, effectiveWavelength * lerpNumber(1.45, 0.55, audioDrive), reactiveIntensity),
					state.sliders.depthEchoWavelength.min,
					state.sliders.depthEchoWavelength.max
				);
			}
			if (state.depthEchoDutyCycleReactiveBool) {
				effectiveDutyCycle = clampNumber(
					depthRuntime.applyReactiveDelta(effectiveDutyCycle, effectiveDutyCycle + (audioDrive - 0.5) * 3.2, reactiveIntensity),
					state.sliders.depthEchoDutyCycle.min,
					state.sliders.depthEchoDutyCycle.max
				);
			}
			if (state.depthEchoFadeReactiveBool) {
				effectiveFade = clampNumber(
					depthRuntime.applyReactiveDelta(effectiveFade, effectiveFade + (audioDrive - 0.5) * 1.8, reactiveIntensity),
					state.sliders.depthEchoFade.min,
					state.sliders.depthEchoFade.max
				);
			}
			var effectivePhase = depthRuntime.wrapEchoPhase(state.sliders.depthEchoPhase.value + state.depthEchoPhaseOffset, effectiveWavelength);
			if (state.depthEchoPhaseReactiveBool) {
				effectivePhase = depthRuntime.wrapEchoPhase(effectivePhase + audioDrive * effectiveWavelength * reactiveIntensity * 2, effectiveWavelength);
			}
			return {
				depthMode: getDepthModeFloat(state.depthModeKey),
				depthThreshold: state.sliders.depthThreshold.value,
				depthFade: state.sliders.depthFade.value,
				depthEchoWavelength: effectiveWavelength,
				depthEchoDutyCycle: effectiveDutyCycle,
				depthEchoFade: effectiveFade,
				depthPhaseOffset: effectivePhase,
				depthMrRetain: state.sliders.depthMrRetain.value,
				depthRadialBool: state.depthRadialBool
			};
		},
		buildDepthRenderState: function(args) {
			const baseState = state.depthModeKey === "echo" ? depthRuntime.getEffectiveEchoDepthState() : depthRuntime.getEffectiveDistanceDepthState();
			return baseState;
		}
	};

	state.sliders = {
		audioReactiveIntensity: createSlider({
			key: "audioReactiveIntensity",
			label: "Intensity",
			value: state.audioReactiveIntensity,
			min: -1,
			max: 1,
			minLabel: "Vis -> Mod. Reality",
			maxLabel: "Mod. Reality -> Vis"
		}),
		manualMix: createSlider({
			key: "manualMix",
			label: "Mix",
			value: state.manualMix,
			min: 0,
			max: 1,
			minLabel: "Visualizer",
			maxLabel: "Modified Reality"
		}),
		flashlightRadius: createSlider({
			key: "flashlightRadius",
			label: "Radius",
			value: state.flashlightRadius,
			min: 0.05,
			max: 0.45,
			minLabel: "Tight",
			maxLabel: "Wide"
		}),
		flashlightSoftness: createSlider({
			key: "flashlightSoftness",
			label: "Softness",
			value: state.flashlightSoftness,
			min: 0.01,
			max: 0.35,
			minLabel: "Hard",
			maxLabel: "Soft"
		}),
		depthEchoPhase: createSlider({
			key: "depthEchoPhase",
			label: "Phase",
			value: state.depthEchoPhase,
			min: 0,
			max: Math.max(0.1, state.depthEchoWavelength),
			minLabel: "0m",
			maxLabel: state.depthEchoWavelength.toFixed(1) + "m",
			formatValue: function(value) { return value.toFixed(1) + "m"; }
		}),
		depthEchoPhaseSpeed: createSlider({
			key: "depthEchoPhaseSpeed",
			label: "Phase-Speed",
			value: state.depthEchoPhaseSpeed,
			min: -10,
			max: 10,
			minLabel: "-10m/s",
			maxLabel: "10m/s",
			formatValue: function(value) { return value.toFixed(1) + "m/s"; },
			normalizeValue: depthRuntime.quantizeDepthEchoPhaseSpeed
		}),
		depthEchoWavelength: createSlider({
			key: "depthEchoWavelength",
			label: "Wavelength",
			value: state.depthEchoWavelength,
			min: 0.1,
			max: 10,
			minLabel: "0.1m",
			maxLabel: "10m",
			formatValue: function(value) { return value.toFixed(1) + "m"; },
			normalizeValue: depthRuntime.quantizeDepthEchoWavelength
		}),
		depthEchoDutyCycle: createSlider({
			key: "depthEchoDutyCycle",
			label: "DutyCycle",
			value: state.depthEchoDutyCycle,
			min: 0,
			max: 1,
			minLabel: "0%",
			maxLabel: "100%",
			formatValue: formatPassthroughPercentText
		}),
		depthEchoFade: createSlider({
			key: "depthEchoFade",
			label: "Fade",
			value: state.depthEchoFade,
			min: 0,
			max: 1,
			minLabel: "Hard",
			maxLabel: "Flow",
			formatValue: formatPassthroughPercentText
		}),
		depthEchoReactiveIntensity: createSlider({
			key: "depthEchoReactiveIntensity",
			label: "Intensity",
			value: state.depthEchoReactiveIntensity,
			min: -1,
			max: 1,
			minLabel: "-100%",
			maxLabel: "100%",
			formatValue: formatPassthroughPercentText
		}),
		depthDistanceReactiveIntensity: createSlider({
			key: "depthDistanceReactiveIntensity",
			label: "Intensity",
			value: state.depthDistanceReactiveIntensity,
			min: -1,
			max: 1,
			minLabel: "-100%",
			maxLabel: "100%",
			formatValue: formatPassthroughPercentText
		}),
		depthDiagnosticRange: createSlider({
			key: "depthDiagnosticRange",
			label: "Range",
			value: state.depthDiagnosticRange,
			min: 0.2,
			max: 8,
			minLabel: "Near",
			maxLabel: "Far",
			formatValue: function(value) { return value.toFixed(2) + "m"; }
		}),
		depthDiagnosticRainbowFrequency: createSlider({
			key: "depthDiagnosticRainbowFrequency",
			label: "Cycles",
			value: state.depthDiagnosticRainbowFrequency,
			min: 0.25,
			max: 20,
			minLabel: "less",
			maxLabel: "many",
			formatValue: function(value) { return value.toFixed(2); }
		}),
		depthThreshold: createSlider({
			key: "depthThreshold",
			label: "Distance",
			value: state.depthThreshold,
			min: 0,
			max: 8,
			minLabel: "0m",
			maxLabel: "Far",
			formatValue: function(value) { return value.toFixed(2) + "m"; }
		}),
		depthFade: createSlider({
			key: "depthFade",
			label: "Fade",
			value: state.depthFade,
			min: 0,
			max: 2,
			minLabel: "Hard",
			maxLabel: "Soft",
			formatValue: function(value) { return value.toFixed(2) + "m"; }
		}),
		depthMrRetain: createSlider({
			key: "depthMrRetain",
			label: "MR Blend",
			value: state.depthMrRetain,
			min: 0,
			max: 1,
			minLabel: "Passthrough",
			maxLabel: "Mod. Reality",
			formatValue: formatPassthroughPercentText
		}),
		lightingDarkness: createSlider({
			key: "lightingDarkness",
			label: "Darkness",
			value: state.lightingDarkness,
			min: 0,
			max: 1,
			minLabel: "Lights Only",
			maxLabel: "Additive"
		}),
		effectAdditiveShare: createSlider({
			key: "effectAdditiveShare",
			label: "Additive",
			value: state.effectAdditiveShare,
			min: 0,
			max: 1,
			minLabel: "Off",
			maxLabel: "Full"
		}),
		effectAlphaBlendShare: createSlider({
			key: "effectAlphaBlendShare",
			label: "Alpha Blend",
			value: state.effectAlphaBlendShare,
			min: 0,
			max: 1,
			minLabel: "Off",
			maxLabel: "Full"
		})
	};
	const updateDepthEchoPhaseSliderRange = function() {
		state.sliders.depthEchoPhase.max = Math.max(0.1, state.sliders.depthEchoWavelength.value);
		state.sliders.depthEchoPhase.maxLabel = state.sliders.depthEchoWavelength.value.toFixed(1) + "m";
		updateSlider(state.sliders.depthEchoPhase, state.sliders.depthEchoPhase.value);
	};
	const syncDepthMrRetainForMode = function() {
		if (state.depthModeKey === "echo") {
			state.depthEchoMrRetain = state.sliders.depthMrRetain.value;
		} else {
			state.depthDistanceMrRetain = state.sliders.depthMrRetain.value;
		}
	};
	const setPassthroughSliderValue = function(key, value) {
		const slider = state.sliders[key];
		if (!slider) {
			return;
		}
		updateSlider(slider, value);
		if (key === "depthEchoWavelength") {
			updateDepthEchoPhaseSliderRange();
			state.depthEchoPhaseOffset = depthRuntime.wrapEchoPhase(state.depthEchoPhaseOffset, slider.value);
		}
		if (key === "depthMrRetain") {
			syncDepthMrRetainForMode();
		}
	};
	updateDepthEchoPhaseSliderRange();
	syncDepthMrRetainForMode();

	const getFlashlightMasks = function(args) {
		if (!state.flashlightActiveBool) {
			return [];
		}
		const masks = [];
		const controllerRays = args.controllerRays || [];
		for (let i = 0; i < controllerRays.length; i += 1) {
			const ray = controllerRays[i];
			if (!ray || !ray.origin || !ray.dir) {
				continue;
			}
			const projectedUv = projectWorldPointToUv(
				args.viewMatrix,
				args.projMatrix,
				ray.origin.x + ray.dir.x * 6,
				ray.origin.y + ray.dir.y * 6,
				ray.origin.z + ray.dir.z * 6
			);
			if (!projectedUv) {
				continue;
			}
			masks.push({
				x: projectedUv.x,
				y: projectedUv.y,
				radius: state.sliders.flashlightRadius.value,
				softness: state.sliders.flashlightSoftness.value
			});
			if (masks.length >= PASSTHROUGH_MAX_FLASHLIGHTS) {
				break;
			}
		}
		return masks;
	};
	const getUiState = function() {
		const backgroundControlState = getBackgroundControlDefinitions(state);
		const passthroughControlState = getPassthroughControlDefinitions(state);
		const lightingControlState = getPassthroughLightingControlDefinitions(state);
		return {
			availableBool: state.availableBool,
			fallbackBool: state.fallbackBool,
			statusText: state.statusText,
			mixModes: backgroundMixModeDefinitions,
			selectedMixModeKey: state.mixModeKey,
			mixModeVisibleBool: backgroundControlState.mixModeVisibleBool,
			backgroundControls: backgroundControlState.controls || [],
			flashlightActiveBool: state.flashlightActiveBool,
			depthActiveBool: state.depthActiveBool,
			depthRadialBool: state.depthRadialBool,

			depthModes: passthroughDepthModeDefinitions,
			selectedDepthModeKey: state.depthModeKey,
			depthDiagnosticPalettes: passthroughDepthDiagnosticPaletteDefinitions,
			selectedDepthDiagnosticPaletteKey: state.depthDiagnosticPaletteKey,
			depthDiagnosticViews: passthroughDepthDiagnosticViewDefinitions,
			selectedDepthDiagnosticViewKey: state.depthDiagnosticViewKey,
			depthDiagnosticSources: passthroughDepthDiagnosticSourceDefinitions,
			selectedDepthDiagnosticSourceKey: state.depthDiagnosticSourceKey,
			depthDiagnosticTypes: passthroughDepthDiagnosticTypeDefinitions,
			selectedDepthDiagnosticTypeKey: state.depthDiagnosticTypeKey,
			depthDiagnosticFormats: passthroughDepthDiagnosticFormatDefinitions,
			selectedDepthDiagnosticFormatKey: state.depthDiagnosticFormatKey,
			usableDepthAvailableBool: state.usableDepthAvailableBool,
			passthroughControls: passthroughControlState.controls || [],
			distanceReactiveControl: passthroughControlState.distanceReactiveControl || null,
			echoReactiveControls: passthroughControlState.echoReactiveControls || [],
			echoReactiveIntensityVisibleBool: !!passthroughControlState.echoReactiveIntensityVisibleBool,
			lightingModes: passthroughLightingModeDefinitions,
			lightingAnchorModes: passthroughLightingAnchorModeDefinitions,
			selectedLightingModeKey: state.lightingModeKey,
			selectedLightingAnchorModeKey: state.lightingAnchorModeKey,
			lightingControls: lightingControlState.controls || [],
			effectSemanticControls: lightingControlState.effectSemanticControls || [],
			audioDrive: state.smoothedBlendDrive,
			visibleShare: getPassthroughVisibleShare(state, state.smoothedBlendDrive),
			effectSemanticModeKey: state.effectSemanticModeKey,
			effectSemanticModeLabel: getPassthroughEffectSemanticModeLabel(state.effectSemanticModeKey)
		};
	};
	const buildOverlayRenderState = function(queryArgs, depthRenderState) {
		queryArgs = queryArgs || {};
		const visibleShare = getPassthroughVisibleShare(state, state.smoothedBlendDrive);
		const lightingState = queryArgs.sceneLightingState || null;
		const lightingColor = getAveragedLightingColor(lightingState);
		const additiveStrength = state.lightingModeKey === "uniform" ? clampNumber(state.smoothedAudioDrive * 0.9, 0, 0.95) : 0;
		const darkness = state.lightingModeKey === "none" ? 1 : state.sliders.lightingDarkness.value;
		const lightLayerAdditiveScale = state.effectSemanticModeKey === PASSTHROUGH_EFFECT_SEMANTIC_MODE_ALPHA_BLEND_ONLY ? 0 : state.sliders.effectAdditiveShare.value;
		const lightLayerAlphaBlendScale = state.effectSemanticModeKey === PASSTHROUGH_EFFECT_SEMANTIC_MODE_ADDITIVE_ONLY ? 0 : state.sliders.effectAlphaBlendShare.value;
		return {
			visibleShare: visibleShare,
			maskCount: 0,
			masks: [],
			depth: depthRenderState,
			darkAlpha: 1 - darkness,
			additiveColor: lightingColor,
			additiveStrength: additiveStrength,
			lightingModeKey: state.lightingModeKey,
			effectSemanticModeKey: state.effectSemanticModeKey,
			lightLayerAdditiveScale: lightLayerAdditiveScale,
			lightLayerAlphaBlendScale: lightLayerAlphaBlendScale,
			lightLayers: buildProjectedLightLayers(queryArgs, state)
		};
	};
	const getPunchRenderState = function(queryArgs) {
		var depth = null;
		var flashlight = null;
	if (state.depthActiveBool && state.depthVisualMaskingEnabledBool && state.depthModeKey !== "diagnostic") {
		depth = depthRuntime.buildDepthRenderState(queryArgs);
	}
		if (state.flashlightActiveBool) {
			var masks = getFlashlightMasks(queryArgs || {});
			if (masks.length) {
				flashlight = {masks: masks};
			}
		}
		if (!depth && !flashlight) {
			return null;
		}
		return {depth: depth, flashlight: flashlight};
	};
	const getBackgroundCompositeState = function() {
		return {
			alpha: clampNumber(1 - getPassthroughVisibleShare(state, state.smoothedBlendDrive), 0, 1),
			maskCount: 0,
			masks: []
		};
	};
	const getOverlayRenderState = function(queryArgs) {
		return buildOverlayRenderState(queryArgs, state.depthActiveBool && state.depthVisualMaskingEnabledBool && state.depthModeKey !== "diagnostic" ? depthRuntime.buildDepthRenderState(queryArgs) : null);
	};
	const getDepthDiagnosticsRenderState = function() {
		if (!state.depthActiveBool || state.depthModeKey !== "diagnostic") {
			return null;
		}
		return {
			depthMetricMode: state.depthRadialBool ? "radial" : "planar",
			paletteKey: state.depthDiagnosticPaletteKey,
			viewKey: state.depthDiagnosticViewKey,
			rangeMeters: state.sliders.depthDiagnosticRange.value,
			rainbowFrequency: state.sliders.depthDiagnosticRainbowFrequency.value
		};
	};
	const toggleStateBool = function(key) {
		state[key] = !state[key];
	};
	const cycleStateMode = function(key, definitions, direction) {
		state[key] = cycleModeKey(definitions, state[key], direction < 0 ? -1 : 1);
	};
	const selectKnownStateMode = function(key, definitions, nextKey) {
		state[key] = selectKnownModeKey(definitions, nextKey, state[key]);
	};
	const getMenuSliderControlValue = function(control) {
		return control && control.type === "slider" && control.value != null ? control.value : null;
	};
	const echoReactiveStateKeys = {
		depthEchoPhaseReactive: "depthEchoPhaseReactiveBool",
		depthEchoPhaseSpeedReactive: "depthEchoPhaseSpeedReactiveBool",
		depthEchoWavelengthReactive: "depthEchoWavelengthReactiveBool",
		depthEchoDutyCycleReactive: "depthEchoDutyCycleReactiveBool",
		depthEchoFadeReactive: "depthEchoFadeReactiveBool"
	};
	const updateFrame = function(frameArgs) {
		frameArgs = frameArgs || {};
		const targetDrive = getWeightedAudioDrive(frameArgs.audioMetrics);
		const targetBlendDrive = getPassthroughBlendDrive(frameArgs.audioMetrics);
		const delta = clampNumber(frameArgs.delta == null ? 1 / 60 : frameArgs.delta, 0, 0.1);
		const smoothFactor = clampNumber(delta * 9.5, 0.05, 1);
		state.smoothedAudioDrive = lerpNumber(state.smoothedAudioDrive, targetDrive, smoothFactor);
		state.smoothedBlendDrive = lerpNumber(state.smoothedBlendDrive, targetBlendDrive, smoothFactor);
		let effectivePhaseSpeed = state.sliders.depthEchoPhaseSpeed.value;
		if (state.depthEchoPhaseSpeedReactiveBool) {
			effectivePhaseSpeed = clampNumber(
				depthRuntime.applyReactiveDelta(effectivePhaseSpeed, effectivePhaseSpeed + (state.smoothedBlendDrive - 0.5) * 20, state.sliders.depthEchoReactiveIntensity.value),
				state.sliders.depthEchoPhaseSpeed.min,
				state.sliders.depthEchoPhaseSpeed.max
			);
		}
		state.depthEchoPhaseOffset += effectivePhaseSpeed * delta;
		if (state.sliders.depthEchoWavelength.value > 0.0001 && Number.isFinite(state.depthEchoPhaseOffset)) {
			state.depthEchoPhaseOffset = depthRuntime.wrapEchoPhase(state.depthEchoPhaseOffset, state.sliders.depthEchoWavelength.value);
		}
	};
	const setDepthAvailability = function(availableBool) {
		if (!!availableBool && !state.usableDepthAvailableBool) {
			state.depthActiveBool = true;
		}
		state.usableDepthAvailableBool = !!availableBool;
	};
	return {
		state: state,
		setSessionState: function(args) {
			const availabilityState = getPassthroughAvailabilityState(args);
			state.supportedBool = !!(args && args.supportedBool);
			state.availableBool = availabilityState.availableBool;
			state.fallbackBool = availabilityState.fallbackBool;
			state.statusText = availabilityState.statusText;
		},
		updateFrame: updateFrame,
		setDepthAvailability: setDepthAvailability,
		toggleFlashlight: function() {
			toggleStateBool("flashlightActiveBool");
		},
		toggleDepth: function() {
			toggleStateBool("depthActiveBool");
		},
		toggleDepthRadial: function() {
			toggleStateBool("depthRadialBool");
		},
		cycleDepthMode: function(direction) {
			cycleStateMode("depthModeKey", passthroughDepthModeDefinitions, direction);
			updateSlider(state.sliders.depthMrRetain, getDepthMrRetainForMode(state.depthModeKey));
		},
		cycleDepthDiagnosticPalette: function(direction) {
			cycleStateMode("depthDiagnosticPaletteKey", passthroughDepthDiagnosticPaletteDefinitions, direction);
		},
		cycleDepthDiagnosticView: function(direction) {
			cycleStateMode("depthDiagnosticViewKey", passthroughDepthDiagnosticViewDefinitions, direction);
		},
		cycleDepthDiagnosticSource: function(direction) {
			cycleStateMode("depthDiagnosticSourceKey", passthroughDepthDiagnosticSourceDefinitions, direction);
		},
		cycleDepthDiagnosticType: function(direction) {
			cycleStateMode("depthDiagnosticTypeKey", passthroughDepthDiagnosticTypeDefinitions, direction);
		},
		cycleDepthDiagnosticFormat: function(direction) {
			cycleStateMode("depthDiagnosticFormatKey", passthroughDepthDiagnosticFormatDefinitions, direction);
		},
		getDepthSessionOptions: function() {
			return {
				sourceKey: state.depthDiagnosticSourceKey,
				typeKey: state.depthDiagnosticTypeKey,
				formatKey: state.depthDiagnosticFormatKey
			};
		},

		cycleLightingMode: function(direction) {
			cycleStateMode("lightingModeKey", passthroughLightingModeDefinitions, direction);
		},
		cycleLightingAnchorMode: function(direction) {
			cycleStateMode("lightingAnchorModeKey", passthroughLightingAnchorModeDefinitions, direction);
		},
		selectLightingMode: function(key) {
			selectKnownStateMode("lightingModeKey", passthroughLightingModeDefinitions, key);
		},
		selectMixMode: function(key) {
			selectKnownStateMode("mixModeKey", backgroundMixModeDefinitions, key);
		},
		selectEffectSemanticMode: function(key) {
			selectKnownStateMode("effectSemanticModeKey", passthroughEffectSemanticModeDefinitions, key);
		},
		getDepthProcessingConfig: function() {
			if (!state.depthActiveBool) {
				return null;
			}
			const baseState = depthRuntime.buildDepthRenderState(null);
			if (!baseState) {
				return null;
			}
			return {
				depthMetricMode: state.depthRadialBool ? "radial" : "planar",
				depthMode: baseState.depthMode,
				depthThreshold: baseState.depthThreshold,
				depthFade: baseState.depthFade,
				depthEchoWavelength: baseState.depthEchoWavelength,
				depthEchoDutyCycle: baseState.depthEchoDutyCycle,
				depthEchoFade: baseState.depthEchoFade,
				depthPhaseOffset: baseState.depthPhaseOffset
			};
		},
		setControlValue: function(key, value) {
			const sliderValue = getMenuSliderControlValue(value);
			if (sliderValue != null) {
				setPassthroughSliderValue(key, sliderValue);
			}
		},
		toggleDepthDistanceReactive: function() {
			state.depthDistanceReactiveBool = !state.depthDistanceReactiveBool;
		},
		toggleDepthEchoReactive: function(key) {
			const stateKey = echoReactiveStateKeys[key];
			if (stateKey) {
				state[stateKey] = !state[stateKey];
			}
		},
		getPunchRenderState: getPunchRenderState,
		getBackgroundCompositeState: getBackgroundCompositeState,
		getOverlayRenderState: getOverlayRenderState,
		getDepthDiagnosticsRenderState: getDepthDiagnosticsRenderState,
		getUiState: getUiState
	};
};

const applyVisualizerBackgroundComposite = function(visualizerEngine, compositeState) {
	if (!visualizerEngine) {
		return;
	}
	if (visualizerEngine.setBackgroundCompositeState) {
		visualizerEngine.setBackgroundCompositeState(compositeState);
		return;
	}
	if (visualizerEngine.setBackgroundBlend) {
		visualizerEngine.setBackgroundBlend(1 - (compositeState && compositeState.alpha != null ? compositeState.alpha : 1), true);
	}
};

const createPunchRenderer = function() {
	let gl = null;
	let buffer = null;
	let texture2dProgram = null;
	let texture2dLocs = null;
	let flashlightProgram = null;
	let flashlightLocs = null;
	const flashlightMaskCenters = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const flashlightMaskParams = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);

	// Canonical 2D raw-depth fullscreen punch shader.
	const texture2dFragSource = [
		"precision highp float;",
		"uniform sampler2D visibilityTexture;",
		"uniform float depthMrRetain;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"float punchMask=texture2D(visibilityTexture,vScreenUv).r;",
		"gl_FragColor=vec4(0.0,0.0,0.0,mix(depthMrRetain,1.0,punchMask));",
		"}"
	].join("");

	const flashlightFragSource = [
		"precision highp float;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"varying vec2 vScreenUv;",
		"void main(){",
		"float alpha=1.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float radius=max(maskParams[i].x,0.0001);",
		"float softness=max(maskParams[i].y,0.0001);",
		"float inner=max(0.0,radius-softness);",
		"alpha*=smoothstep(inner,radius,distance(vScreenUv,maskCenters[i]));",
		"}",
		"gl_FragColor=vec4(0.0,0.0,0.0,alpha);",
		"}"
	].join("");

	const buildDepthLocs = function(prog) {
		return {
			position: gl.getAttribLocation(prog, "position"),
			visibilityTexture: gl.getUniformLocation(prog, "visibilityTexture"),
			depthMrRetain: gl.getUniformLocation(prog, "depthMrRetain")
		};
	};

	const drawFlashlightPunch = function(punchState) {
		if (!punchState.masks || punchState.masks.length === 0) { return; }
		if (!flashlightProgram) {
			flashlightProgram = createProgram(gl, fullscreenVertexSource, flashlightFragSource, "Punch flashlight");
			flashlightLocs = {
				position: gl.getAttribLocation(flashlightProgram, "position"),
				maskCount: gl.getUniformLocation(flashlightProgram, "maskCount"),
				maskCenters: gl.getUniformLocation(flashlightProgram, "maskCenters"),
				maskParams: gl.getUniformLocation(flashlightProgram, "maskParams")
			};
		}
		for (let i = 0; i < flashlightMaskCenters.length; i += 1) {
			flashlightMaskCenters[i] = 0;
			flashlightMaskParams[i] = 0;
		}
		for (let i = 0; i < punchState.masks.length && i < PASSTHROUGH_MAX_FLASHLIGHTS; i += 1) {
			flashlightMaskCenters[i * 2] = punchState.masks[i].x;
			flashlightMaskCenters[i * 2 + 1] = punchState.masks[i].y;
			flashlightMaskParams[i * 2] = punchState.masks[i].radius;
			flashlightMaskParams[i * 2 + 1] = punchState.masks[i].softness;
		}
		gl.useProgram(flashlightProgram);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.blendFuncSeparate(gl.ZERO, gl.SRC_ALPHA, gl.ZERO, gl.SRC_ALPHA);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(flashlightLocs.position);
		gl.vertexAttribPointer(flashlightLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.uniform1f(flashlightLocs.maskCount, punchState.masks.length);
		gl.uniform2fv(flashlightLocs.maskCenters, flashlightMaskCenters);
		gl.uniform2fv(flashlightLocs.maskParams, flashlightMaskParams);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	};

	const drawDepthPunch = function(depthInfo, punchState) {
		if (!depthInfo) { return; }
		if (!depthInfo.visibilityTexture) {
			return;
		}
		if (!texture2dProgram) {
			texture2dProgram = createProgram(gl, fullscreenVertexSource, texture2dFragSource, "Depth punch texture2d");
			texture2dLocs = buildDepthLocs(texture2dProgram);
		}
		gl.useProgram(texture2dProgram);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.blendFuncSeparate(gl.ZERO, gl.SRC_ALPHA, gl.ZERO, gl.SRC_ALPHA);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, depthInfo.visibilityTexture);
		gl.uniform1i(texture2dLocs.visibilityTexture, 0);
		gl.uniform1f(texture2dLocs.depthMrRetain, punchState.depthMrRetain || 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(texture2dLocs.position);
		gl.vertexAttribPointer(texture2dLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	};

	return {
		init: function(glContext) {
			gl = glContext;
			buffer = createFullscreenTriangleBuffer(gl);
		},
		draw: function(punchState, depthInfo) {
			if (!punchState) { return; }
			if (punchState.depth) {
				drawDepthPunch(depthInfo, punchState.depth);
			}
			if (punchState.flashlight) {
				drawFlashlightPunch(punchState.flashlight);
			}
		}
	};
};
