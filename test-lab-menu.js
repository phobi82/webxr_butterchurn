// TestLab uses a reduced menu so effect review stays focused.

const getTestLabAudioModeLabel = function(args) {
	args = args || {};
	if (args.audioSourceKind === "debug") {
		return "Debug";
	}
	if (args.audioSourceKind === "stream") {
		return args.audioSourceName ? "Live: " + args.audioSourceName : "Live";
	}
	return "None";
};

const createTestLabAudioBarItems = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return [
		{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
		{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
		{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
		{label: "Beat Pulse", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)},
		{label: "Strobe", value: clampNumber(audioMetrics.strobeGate || 0, 0, 1)},
		{label: "Left Hit", value: clampNumber(audioMetrics.leftImpact || 0, 0, 1)},
		{label: "Right Hit", value: clampNumber(audioMetrics.rightImpact || 0, 0, 1)}
	];
};

const createTestLabMenuSections = function(args) {
	args = args || {};
	const controls = [
		createCyclerMenuControlState({
			key: "sceneLightPreset",
			label: "Active Effect",
			valueText: args.currentLightPresetEffectName || args.currentLightPresetName || "Soft Wash",
			metaText: args.currentLightPresetEffectDescription || args.currentLightPresetDescription || "",
			hoveredAction: args.hoveredLightPresetAction || ""
		})
	];
	if ((args.currentLightPresetVariantCount || 1) > 1) {
		controls.push(createCyclerMenuControlState({
			key: "sceneLightVariant",
			label: "Variant",
			valueText: args.currentLightPresetVariantLabel || "Base",
			metaText: "Surface bias: " + (args.currentLightPresetSurfaceKey || "mixed"),
			hoveredAction: args.hoveredLightPresetVariantAction || ""
		}));
	}
	const effectReviewSliderControls = (args.sceneLightingControls || []).concat(args.effectSemanticControls || []);
	for (let i = 0; i < effectReviewSliderControls.length; i += 1) {
		const sliderControl = effectReviewSliderControls[i];
		if (!sliderControl || !sliderControl.control) {
			continue;
		}
		controls.push(createSliderMenuControlState({
			key: sliderControl.control.key,
			label: sliderControl.control.label,
			valueText: formatMenuPercentText(sliderControl.control.value),
			sliderU: sliderControl.sliderU || 0,
			minLabel: sliderControl.control.minLabel,
			maxLabel: sliderControl.control.maxLabel,
			hoveredBool: !!sliderControl.hoveredBool,
			activeBool: !!sliderControl.activeBool
		}));
	}
	return [
		createMenuSectionState({
			key: "testLabEffect",
			title: "Effect Review",
			badgeText: ((args.currentLightPresetEffectIndex || 0) + 1) + " / " + (args.currentLightPresetEffectCount || 1),
			statusText: "Variant: " + ((args.currentLightPresetVariantIndex || 0) + 1) + " / " + (args.currentLightPresetVariantCount || 1),
			controls: controls
		}),
		createMenuSectionState({
			key: "testLabIsolation",
			title: "Isolation",
			statusText: "Audio: " + getTestLabAudioModeLabel(args) + " | Baseline: Uniform / Manual / Mix 100%",
			controls: []
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredExitVrBool: !!args.hoveredExitVrBool
		})
	].filter(Boolean);
};
