// app/menu.js
const createMenuView = function(options) {
	options = options || {};
	const emptyModeNames = ["No mode"];
	const emptyPresetNames = ["No preset"];
	const titleText = options.titleText || "VR Control Deck";
	const buildAudioBarItems = options.getAudioBarItems || function(audioMetrics) {
		audioMetrics = audioMetrics || emptyAudioMetrics;
		return [
			{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
			{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
			{label: "Kick", value: clampNumber(audioMetrics.kickGate || 0, 0, 1)},
			{label: "Bass Hit", value: clampNumber(audioMetrics.bassHit || 0, 0, 1)},
			{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
			{label: "Beat Pulse", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)},
			{label: "Strobe", value: clampNumber(audioMetrics.strobeGate || 0, 0, 1)},
			{label: "Fill", value: clampNumber(audioMetrics.roomFill || 0, 0, 1)},
			{label: "Left Hit", value: clampNumber(audioMetrics.leftImpact || 0, 0, 1)},
			{label: "Right Hit", value: clampNumber(audioMetrics.rightImpact || 0, 0, 1)}
		];
	};
	const documentRef = options.documentRef || document;
	const previewParentElement = options.previewParentElement || options.parentElement || documentRef.body;
	const menuLayoutWidth = options.canvasWidth || 1280;
	const menuCanvas = documentRef.createElement("canvas");
	menuCanvas.width = menuLayoutWidth;
	menuCanvas.height = options.canvasHeight || 960;
	menuCanvas.setAttribute("role", "img");
	menuCanvas.setAttribute("aria-label", "VR menu interface");
	const menuCtx = menuCanvas.getContext("2d");
	const previewCanvas = documentRef.createElement("canvas");
	previewCanvas.setAttribute("role", "img");
	previewCanvas.setAttribute("aria-label", "Desktop menu preview");
	const previewCtx = previewCanvas.getContext("2d");
	const previewWidthPixels = options.desktopMenuPreviewWidthPixels || 420;
	previewCanvas.width = menuCanvas.width;
	previewCanvas.height = menuCanvas.height;
	applyStyles(previewCanvas, {
		position: "fixed",
		right: "12px",
		top: "12px",
		width: previewWidthPixels + "px",
		height: Math.round(previewWidthPixels * menuCanvas.height / menuLayoutWidth) + "px",
		border: "1px solid #ffff00",
		backgroundColor: "rgba(0, 0, 32, 0.92)",
		display: options.initialDesktopPreviewVisibleBool === false ? "none" : "block",
		pointerEvents: "auto",
		cursor: "pointer",
		zIndex: "20"
	});
	applyStyles(previewCanvas, options.previewStyle);
	previewParentElement.appendChild(previewCanvas);
	const getSectionPanelLayout = function(panelTop, section) {
		section = section || {};
		const controls = section.controls || [];
		let cursorY = panelTop + 72;
		const controlLayouts = [];
		for (let i = 0; i < controls.length; i += 1) {
			const control = controls[i];
			const controlLayout = {key: control.key, type: control.type};
			if (control.type === "cycler") {
				controlLayout.labelY = cursorY + 20;
				controlLayout.rowTop = cursorY + (control.label ? 28 : 4);
				controlLayout.rowHeight = 78;
				controlLayout.arrowButtonTop = controlLayout.rowTop - 10;
				controlLayout.arrowButtonHeight = controlLayout.rowHeight + 10;
				controlLayout.valueY = controlLayout.rowTop + 22;
				controlLayout.metaY = controlLayout.rowTop + 50;
				cursorY = controlLayout.arrowButtonTop + controlLayout.arrowButtonHeight + 10;
			}
			if (control.type === "choiceRow") {
				const checkboxRowBool = control.rowStyle === "checkbox";
				controlLayout.labelY = cursorY;
				controlLayout.rowTop = cursorY + (control.label ? 24 : 6);
				controlLayout.rowHeight = checkboxRowBool ? 54 : 70;
				cursorY = controlLayout.rowTop + controlLayout.rowHeight + (checkboxRowBool ? 14 : 16);
			}
			if (control.type === "checkbox") {
				controlLayout.labelY = cursorY;
				controlLayout.rowTop = cursorY + 8;
				controlLayout.rowHeight = 54;
				cursorY = controlLayout.rowTop + controlLayout.rowHeight + 14;
			}
			if (control.type === "slider") {
				controlLayout.trackY = cursorY + 30;
				controlLayout.labelY = controlLayout.trackY;
				controlLayout.hitTop = controlLayout.trackY - 36;
				controlLayout.hitBottom = controlLayout.trackY + 36;
				cursorY = controlLayout.hitBottom + 4;
			}
			controlLayouts.push(controlLayout);
		}
		const statusY = section.statusText ? cursorY + 2 : -1000;
		if (section.statusText) {
			cursorY = statusY + 18;
		}
		return {
			key: section.key,
			panelTop: panelTop,
			panelHeight: cursorY - panelTop + 18,
			titleY: panelTop + 38,
			badgeY: panelTop + 38,
			statusY: statusY,
			controlLayouts: controlLayouts
		};
	};
	const getSectionLayouts = function(menuSections, startTop, sectionGap) {
		const layouts = [];
		const layoutByKey = {};
		let currentTop = startTop;
		for (let i = 0; i < menuSections.length; i += 1) {
			const sectionLayout = getSectionPanelLayout(currentTop, menuSections[i]);
			layouts.push(sectionLayout);
			layoutByKey[menuSections[i].key] = sectionLayout;
			currentTop += sectionLayout.panelHeight + sectionGap;
		}
		return {
			layouts: layouts,
			layoutByKey: layoutByKey,
			nextTop: currentTop
		};
	};
	let cachedLayoutKey = "";
	let cachedLayoutResult = null;
	const buildLayoutCacheKey = function(menuSections) {
		let key = menuSections.length + ":";
		for (let i = 0; i < menuSections.length; i += 1) {
			const controls = menuSections[i].controls || [];
			key += menuSections[i].key + controls.length;
			for (let ci = 0; ci < controls.length; ci += 1) {
				key += controls[ci].type || "";
			}
			key += "|";
		}
		return key;
	};
	const getLayoutMetrics = function(menuSections) {
		menuSections = menuSections || [];
		const layoutKey = buildLayoutCacheKey(menuSections);
		if (layoutKey === cachedLayoutKey && cachedLayoutResult) {
			cachedLayoutResult.menuSections = menuSections;
			return cachedLayoutResult;
		}
		const audioBarItems = buildAudioBarItems(emptyAudioMetrics).length;
		const innerFrameInset = 24;
		const audioPanelTop = 108;
		const audioBarTop = 116;
		const audioBarSpacing = 12;
		const audioPanelHeight = (audioBarTop - audioPanelTop) + (audioBarItems - 1) * audioBarSpacing + 18;
		const sectionGap = 12;
		const lowerSections = getSectionLayouts(menuSections, audioPanelTop + audioPanelHeight + sectionGap, sectionGap);
		const prevX = menuLayoutWidth * options.presetPrevMinU;
		const prevWidth = menuLayoutWidth * (options.presetPrevMaxU - options.presetPrevMinU);
		const nextX = menuLayoutWidth * options.presetNextMinU;
		const nextWidth = menuLayoutWidth * (options.presetNextMaxU - options.presetNextMinU);
		const centerX = menuLayoutWidth * 0.5;
		const trackStartX = menuLayoutWidth * options.menuSliderMinU;
		const trackEndX = menuLayoutWidth * options.menuSliderMaxU;
		const sliderReachPadPx = 28;
		const lastSectionBottom = lowerSections.layouts.length ? lowerSections.layouts[lowerSections.layouts.length - 1].panelTop + lowerSections.layouts[lowerSections.layouts.length - 1].panelHeight : audioPanelTop + audioPanelHeight;
		const canvasHeight = Math.ceil(lastSectionBottom + 30 + sectionGap);
		const contentInset = canvasHeight - innerFrameInset - lastSectionBottom;
		const contentLeft = innerFrameInset + contentInset;
		const contentRight = menuLayoutWidth - innerFrameInset - contentInset;
		cachedLayoutResult = Object.assign({
			contentLeft: contentLeft,
			contentWidth: contentRight - contentLeft,
			contentRight: contentRight,
			canvasHeight: canvasHeight,
			audioPanelTop: audioPanelTop,
			audioBarTop: audioBarTop,
			audioBarSpacing: audioBarSpacing,
			audioPanelHeight: audioPanelHeight,
			prevX: prevX,
			prevWidth: prevWidth,
			nextX: nextX,
			nextWidth: nextWidth,
			centerX: centerX,
			trackStartX: trackStartX,
			trackEndX: trackEndX,
			sliderReachPadPx: sliderReachPadPx,
			sliderHalfHeightPx: options.menuSliderHalfHeight * canvasHeight,
			menuSections: menuSections,
			sectionLayoutByKey: lowerSections.layoutByKey,
			sectionLayouts: lowerSections.layouts
		});
		cachedLayoutKey = layoutKey;
		return cachedLayoutResult;
	};
	const syncCanvasSize = function(layout) {
		const targetHeight = layout.canvasHeight;
		if (menuCanvas.height !== targetHeight) {
			menuCanvas.height = targetHeight;
		}
		if (previewCanvas.width !== menuCanvas.width || previewCanvas.height !== targetHeight) {
			previewCanvas.width = menuCanvas.width;
			previewCanvas.height = targetHeight;
		}
		applyStyles(previewCanvas, {
			width: previewWidthPixels + "px",
			height: Math.round(previewWidthPixels * targetHeight / menuLayoutWidth) + "px"
		});
	};
	const getMenuPlaneDimensions = function(menuSections) {
		const layout = getLayoutMetrics(menuSections);
		const worldMenuWidth = options.menuWorldWidth || options.menuWidth || 0.74;
		return {
			width: worldMenuWidth,
			height: worldMenuWidth * (layout.canvasHeight / menuLayoutWidth)
		};
	};
	const drawCenteredFittedText = function(text, centerX, topY, maxWidth, fontSize, minFontSize, color, weight) {
		let currentFontSize = fontSize;
		while (currentFontSize > minFontSize) {
			menuCtx.font = (weight || "") + " " + currentFontSize + "px Arial";
			if (menuCtx.measureText(text).width <= maxWidth) { break; }
			currentFontSize -= 2;
		}
		menuCtx.font = (weight || "") + " " + currentFontSize + "px Arial";
		menuCtx.fillStyle = color;
		menuCtx.fillText(text, centerX, topY);
	};
	const getSectionInteraction = function(layout, x, y) {
		let moduleCycleControlKey = "";
		let moduleCycleAction = "";
		let moduleChoiceControlKey = "";
		let moduleChoiceItemKey = "";
		let moduleSliderControlKey = "";
		for (let i = 0; i < layout.menuSections.length; i += 1) {
			const section = layout.menuSections[i];
			const sectionLayout = layout.sectionLayoutByKey[section.key];
			if (!sectionLayout) {
				continue;
			}
			for (let j = 0; j < sectionLayout.controlLayouts.length; j += 1) {
				const controlLayout = sectionLayout.controlLayouts[j];
				const control = section.controls[j];
				if (control.type === "cycler" && y >= controlLayout.arrowButtonTop && y <= controlLayout.arrowButtonTop + controlLayout.arrowButtonHeight) {
					if (x >= layout.prevX && x <= layout.prevX + layout.prevWidth) {
						moduleCycleControlKey = control.key;
						moduleCycleAction = "prev";
					} else if (x >= layout.nextX && x <= layout.nextX + layout.nextWidth) {
						moduleCycleControlKey = control.key;
						moduleCycleAction = "next";
					}
				}
				if (control.type === "choiceRow" && y >= controlLayout.rowTop && y <= controlLayout.rowTop + controlLayout.rowHeight) {
					const items = control.items || [];
					const checkboxRowBool = control.rowStyle === "checkbox";
					const gap = checkboxRowBool ? 28 : 100;
					const rowStartX = layout.prevX;
					const rowEndX = layout.nextX + layout.nextWidth;
					const rowWidth = rowEndX - rowStartX;
					const buttonWidth = (rowWidth - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
					for (let k = 0; k < items.length; k += 1) {
						const itemX = rowStartX + k * (buttonWidth + gap);
						if (x >= itemX && x <= itemX + buttonWidth) {
							moduleChoiceControlKey = control.key;
							moduleChoiceItemKey = items[k].key;
						}
					}
				}
				if (control.type === "checkbox" && y >= controlLayout.rowTop && y <= controlLayout.rowTop + controlLayout.rowHeight && x >= layout.prevX && x <= layout.nextX + layout.nextWidth) {
					moduleChoiceControlKey = control.key;
					moduleChoiceItemKey = "toggle";
				}
				if (control.type === "slider" && y >= controlLayout.hitTop && y <= controlLayout.hitBottom && x >= layout.contentLeft + 20 && x <= layout.contentRight - 20) {
					moduleSliderControlKey = control.key;
				}
			}
		}
		if (moduleSliderControlKey) {
			moduleCycleControlKey = "";
			moduleCycleAction = "";
			moduleChoiceControlKey = "";
			moduleChoiceItemKey = "";
		}
		if (moduleChoiceControlKey) {
			moduleCycleControlKey = "";
			moduleCycleAction = "";
		}
		return {
			moduleCycleControlKey: moduleCycleControlKey,
			moduleCycleAction: moduleCycleAction,
			moduleChoiceControlKey: moduleChoiceControlKey,
			moduleChoiceItemKey: moduleChoiceItemKey,
			moduleSliderControlKey: moduleSliderControlKey
		};
	};
	return {
		menuCanvas: menuCanvas,
		previewCanvas: previewCanvas,
		getPlaneDimensions: function(moduleSections) {
			return getMenuPlaneDimensions(moduleSections);
		},
		getInteractionAtUv: function(u, v, moduleSections) {
			const layout = getLayoutMetrics(moduleSections);
			const x = u * menuLayoutWidth;
			const y = v * layout.canvasHeight;
			const sectionHit = getSectionInteraction(layout, x, y);
			return {
				moduleCycleControlKey: sectionHit.moduleCycleControlKey,
				moduleCycleAction: sectionHit.moduleCycleAction,
				moduleChoiceControlKey: sectionHit.moduleChoiceControlKey,
				moduleChoiceItemKey: sectionHit.moduleChoiceItemKey,
				moduleSliderControlKey: sectionHit.moduleSliderControlKey
			};
		},
		render: function(renderState) {
			renderState = renderState || {};
			const moduleSections = renderState.moduleSections || [];
			const layout = getLayoutMetrics(moduleSections);
			const audioMetrics = renderState.audioMetrics || {};
			const accentRgb = hslToRgb((renderState.sceneTimeSeconds || 0) * 0.03 + 0.04, 0.85, 0.62);
			const accentColor = "rgb(" + Math.round(accentRgb[0] * 255) + "," + Math.round(accentRgb[1] * 255) + "," + Math.round(accentRgb[2] * 255) + ")";
			const accentSoft = "rgba(" + Math.round(accentRgb[0] * 255) + "," + Math.round(accentRgb[1] * 255) + "," + Math.round(accentRgb[2] * 255) + ",0.18)";
			const audioBarItems = buildAudioBarItems(audioMetrics);
			syncCanvasSize(layout);
			menuCtx.setTransform(1, 0, 0, 1, 0, 0);
			menuCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
			menuCtx.setTransform(1, 0, 0, 1, 0, 0);
			const headerGradient = menuCtx.createLinearGradient(0, 0, menuLayoutWidth, layout.canvasHeight);
			headerGradient.addColorStop(0, "#04111f");
			headerGradient.addColorStop(0.55, "#071d33");
			headerGradient.addColorStop(1, "#160c2f");
			menuCtx.fillStyle = headerGradient;
			menuCtx.fillRect(0, 0, menuLayoutWidth, layout.canvasHeight);
			menuCtx.fillStyle = "rgba(255,255,255,0.025)";
			for (let i = 0; i < 24; i += 1) {
				menuCtx.fillRect((i * 73 + (renderState.sceneTimeSeconds || 0) * 28) % (menuLayoutWidth + 40) - 40, 0, 18, layout.canvasHeight);
			}
			menuCtx.fillStyle = accentSoft;
			menuCtx.beginPath();
			menuCtx.arc(menuLayoutWidth * 0.18, layout.canvasHeight * 0.14, 160, 0, Math.PI * 2);
			menuCtx.fill();
			menuCtx.beginPath();
			menuCtx.arc(menuLayoutWidth * 0.84, layout.canvasHeight * 0.24, 210, 0, Math.PI * 2);
			menuCtx.fill();
			menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
			menuCtx.lineWidth = 2;
			menuCtx.strokeRect(14, 14, menuLayoutWidth - 28, layout.canvasHeight - 28);
			menuCtx.strokeStyle = accentColor;
			menuCtx.lineWidth = 4;
			menuCtx.strokeRect(24, 24, menuLayoutWidth - 48, layout.canvasHeight - 48);
			menuCtx.textAlign = "left";
			menuCtx.textBaseline = "top";
			menuCtx.fillStyle = "#f8fbff";
			menuCtx.font = "bold 46px Arial";
			menuCtx.fillText(titleText, layout.contentLeft, 34);
			menuCtx.fillStyle = accentSoft;
			menuCtx.fillRect(layout.contentLeft, layout.audioPanelTop, layout.contentWidth, layout.audioPanelHeight);
			menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
			menuCtx.lineWidth = 2;
			menuCtx.strokeRect(layout.contentLeft, layout.audioPanelTop, layout.contentWidth, layout.audioPanelHeight);
			const audioBarStartX = layout.contentLeft + 150;
			const audioBarWidth = layout.contentWidth - 230;
			for (let i = 0; i < audioBarItems.length; i += 1) {
				const item = audioBarItems[i];
				const rowY = layout.audioBarTop + i * layout.audioBarSpacing;
				menuCtx.textAlign = "left";
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 15px Arial";
				menuCtx.fillText(item.label, layout.contentLeft + 18, rowY);
				menuCtx.fillStyle = "rgba(255,255,255,0.14)";
				menuCtx.fillRect(audioBarStartX, rowY + 2, audioBarWidth, 7);
				menuCtx.fillStyle = accentColor;
				menuCtx.fillRect(audioBarStartX, rowY + 2, audioBarWidth * item.value, 7);
				menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
				menuCtx.lineWidth = 1;
				menuCtx.strokeRect(audioBarStartX, rowY + 2, audioBarWidth, 7);
				menuCtx.textAlign = "right";
				menuCtx.fillStyle = accentColor;
				menuCtx.fillText(Math.round(item.value * 100) + "%", layout.contentRight - 16, rowY);
			}
			const drawChoiceRow = function(control, controlLayout) {
				const items = control.items || [];
				const checkboxRowBool = control.rowStyle === "checkbox";
				const gap = checkboxRowBool ? 28 : 100;
				const rowStartX = layout.prevX;
				const rowEndX = layout.nextX + layout.nextWidth;
				const rowWidth = rowEndX - rowStartX;
				const buttonWidth = (rowWidth - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length);
				for (let i = 0; i < items.length; i += 1) {
					const item = items[i];
					const itemX = rowStartX + i * (buttonWidth + gap);
					if (checkboxRowBool) {
						const boxSize = 28;
						const boxX = itemX + 14;
						const boxY = controlLayout.rowTop + (controlLayout.rowHeight - boxSize) * 0.5;
						const rowCenterY = controlLayout.rowTop + controlLayout.rowHeight * 0.5;
						menuCtx.fillStyle = item.hoveredBool ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)";
						menuCtx.fillRect(itemX, controlLayout.rowTop, buttonWidth, controlLayout.rowHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(itemX, controlLayout.rowTop, buttonWidth, controlLayout.rowHeight);
						menuCtx.fillStyle = item.checkedBool ? accentSoft : "rgba(255,255,255,0.08)";
						menuCtx.fillRect(boxX, boxY, boxSize, boxSize);
						menuCtx.strokeStyle = item.hoveredBool || item.checkedBool ? accentColor : "rgba(255,255,255,0.35)";
						menuCtx.lineWidth = 3;
						menuCtx.strokeRect(boxX, boxY, boxSize, boxSize);
						if (item.checkedBool) {
							menuCtx.strokeStyle = accentColor;
							menuCtx.lineWidth = 4;
							menuCtx.beginPath();
							menuCtx.moveTo(boxX + 6, boxY + 15);
							menuCtx.lineTo(boxX + 12, boxY + 22);
							menuCtx.lineTo(boxX + 22, boxY + 8);
							menuCtx.stroke();
						}
						menuCtx.textBaseline = "middle";
						menuCtx.textAlign = "left";
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 22px Arial";
						menuCtx.fillText(item.label, boxX + boxSize + 14, rowCenterY);
						if (item.valueText) {
							menuCtx.textAlign = "right";
							menuCtx.fillStyle = accentColor;
							menuCtx.font = "bold 18px Arial";
							menuCtx.fillText(item.valueText, itemX + buttonWidth - 14, rowCenterY);
						}
					} else {
						menuCtx.textBaseline = "top";
						menuCtx.fillStyle = item.selectedBool ? accentSoft : item.hoveredBool ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)";
						menuCtx.fillRect(itemX, controlLayout.rowTop, buttonWidth, controlLayout.rowHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(itemX, controlLayout.rowTop, buttonWidth, controlLayout.rowHeight);
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 30px Arial";
						menuCtx.textAlign = "center";
						menuCtx.fillText(item.label, itemX + buttonWidth * 0.5, controlLayout.rowTop + 16);
						if (item.metaText) {
							menuCtx.fillStyle = "rgba(255,255,255,0.7)";
							menuCtx.font = "20px Arial";
							menuCtx.fillText(item.metaText, itemX + buttonWidth * 0.5, controlLayout.rowTop + 48);
						}
					}
				}
				menuCtx.textAlign = "left";
				menuCtx.textBaseline = "top";
			};
			const drawDynamicSection = function(section) {
				const sectionLayout = layout.sectionLayoutByKey[section.key];
				if (!sectionLayout) {
					return;
				}
				menuCtx.textAlign = "left";
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(layout.contentLeft, sectionLayout.panelTop, layout.contentWidth, sectionLayout.panelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, sectionLayout.panelTop, layout.contentWidth, sectionLayout.panelHeight);
				menuCtx.textBaseline = "middle";
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 30px Arial";
				menuCtx.fillText(section.title, layout.contentLeft + 28, sectionLayout.titleY);
				if (section.badgeText) {
					menuCtx.textAlign = "right";
					menuCtx.fillStyle = accentColor;
					menuCtx.fillText(section.badgeText, layout.contentRight - 28, sectionLayout.badgeY);
					menuCtx.textAlign = "left";
				}
				menuCtx.textBaseline = "top";
				for (let i = 0; i < section.controls.length; i += 1) {
					const control = section.controls[i];
					const controlLayout = sectionLayout.controlLayouts[i];
					if (control.type === "cycler") {
						menuCtx.textBaseline = "top";
						if (control.label) {
							menuCtx.fillStyle = "rgba(255,255,255,0.82)";
							menuCtx.font = "bold 20px Arial";
							menuCtx.textAlign = "center";
							menuCtx.fillText(control.label, layout.centerX, controlLayout.labelY);
						}
						menuCtx.fillStyle = control.hoveredAction === "prev" ? accentSoft : "rgba(255,255,255,0.12)";
						menuCtx.fillRect(layout.prevX, controlLayout.arrowButtonTop, layout.prevWidth, controlLayout.arrowButtonHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(layout.prevX, controlLayout.arrowButtonTop, layout.prevWidth, controlLayout.arrowButtonHeight);
						menuCtx.fillStyle = control.hoveredAction === "next" ? accentSoft : "rgba(255,255,255,0.12)";
						menuCtx.fillRect(layout.nextX, controlLayout.arrowButtonTop, layout.nextWidth, controlLayout.arrowButtonHeight);
						menuCtx.strokeRect(layout.nextX, controlLayout.arrowButtonTop, layout.nextWidth, controlLayout.arrowButtonHeight);
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 44px Arial";
						menuCtx.textAlign = "center";
						menuCtx.fillText("<", layout.prevX + layout.prevWidth * 0.5, controlLayout.rowTop + 14);
						menuCtx.fillText(">", layout.nextX + layout.nextWidth * 0.5, controlLayout.rowTop + 14);
						drawCenteredFittedText(control.valueText || "", layout.centerX, controlLayout.valueY, menuLayoutWidth * 0.42, 28, 18, "#ffffff", "bold");
						if (control.metaText) {
							drawCenteredFittedText(control.metaText, layout.centerX, controlLayout.metaY, menuLayoutWidth * 0.56, 18, 14, "rgba(255,255,255,0.65)");
						}
						menuCtx.textAlign = "left";
					}
					if (control.type === "choiceRow") {
						if (control.label) {
							menuCtx.fillStyle = "#ffffff";
							menuCtx.font = "bold 24px Arial";
							menuCtx.fillText(control.label, layout.contentLeft + 28, controlLayout.labelY);
						}
						drawChoiceRow(control, controlLayout);
					}
					if (control.type === "checkbox") {
						const rowStartX = layout.prevX;
						const rowEndX = layout.nextX + layout.nextWidth;
						const rowWidth = rowEndX - rowStartX;
						const boxSize = 34;
						const boxX = rowStartX + 18;
						const boxY = controlLayout.rowTop + 10;
						const rowCenterY = controlLayout.rowTop + controlLayout.rowHeight * 0.5;
						menuCtx.fillStyle = control.hoveredBool ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.1)";
						menuCtx.fillRect(rowStartX, controlLayout.rowTop, rowWidth, controlLayout.rowHeight);
						menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
						menuCtx.lineWidth = 2;
						menuCtx.strokeRect(rowStartX, controlLayout.rowTop, rowWidth, controlLayout.rowHeight);
						menuCtx.fillStyle = control.checkedBool ? accentSoft : "rgba(255,255,255,0.08)";
						menuCtx.fillRect(boxX, boxY, boxSize, boxSize);
						menuCtx.strokeStyle = control.hoveredBool || control.checkedBool ? accentColor : "rgba(255,255,255,0.35)";
						menuCtx.lineWidth = 3;
						menuCtx.strokeRect(boxX, boxY, boxSize, boxSize);
						if (control.checkedBool) {
							menuCtx.strokeStyle = accentColor;
							menuCtx.lineWidth = 4;
							menuCtx.beginPath();
							menuCtx.moveTo(boxX + 7, boxY + 18);
							menuCtx.lineTo(boxX + 15, boxY + 27);
							menuCtx.lineTo(boxX + 28, boxY + 9);
							menuCtx.stroke();
						}
						menuCtx.textBaseline = "middle";
						menuCtx.textAlign = "left";
						menuCtx.fillStyle = "#ffffff";
						menuCtx.font = "bold 24px Arial";
						menuCtx.fillText(control.label, boxX + boxSize + 20, rowCenterY);
						if (control.valueText) {
							menuCtx.textAlign = "right";
							menuCtx.fillStyle = accentColor;
							menuCtx.font = "bold 22px Arial";
							menuCtx.fillText(control.valueText, rowEndX - 18, rowCenterY);
							menuCtx.textAlign = "left";
						}
						menuCtx.textBaseline = "top";
					}
					if (control.type === "slider") {
						const knobX = menuLayoutWidth * control.sliderU;
						if (control.label || control.valueText) {
							menuCtx.textBaseline = "middle";
							menuCtx.fillStyle = "#ffffff";
							menuCtx.font = "bold 26px Arial";
							menuCtx.textAlign = "left";
							menuCtx.fillText(control.label, layout.contentLeft + 28, controlLayout.trackY);
							menuCtx.textAlign = "right";
							menuCtx.fillStyle = accentColor;
							menuCtx.fillText(control.valueText || "", layout.contentRight - 28, controlLayout.trackY);
							menuCtx.textBaseline = "top";
						}
						menuCtx.strokeStyle = "rgba(255,255,255,0.14)";
						menuCtx.lineWidth = 18;
						menuCtx.beginPath();
						menuCtx.moveTo(layout.trackStartX, controlLayout.trackY);
						menuCtx.lineTo(layout.trackEndX, controlLayout.trackY);
						menuCtx.stroke();
						menuCtx.strokeStyle = accentColor;
						menuCtx.lineWidth = 10;
						menuCtx.beginPath();
						menuCtx.moveTo(layout.trackStartX, controlLayout.trackY);
						menuCtx.lineTo(layout.trackEndX, controlLayout.trackY);
						menuCtx.stroke();
						menuCtx.fillStyle = control.hoveredBool || control.activeBool ? accentColor : "#ffffff";
						menuCtx.beginPath();
						menuCtx.arc(knobX, controlLayout.trackY, 22, 0, Math.PI * 2);
						menuCtx.fill();
						menuCtx.fillStyle = "rgba(255,255,255,0.65)";
						menuCtx.font = "18px Arial";
						menuCtx.textBaseline = "top";
						menuCtx.textAlign = "left";
						menuCtx.fillText(control.minLabel || "", layout.trackStartX, controlLayout.trackY + 24);
						menuCtx.textAlign = "right";
						menuCtx.fillText(control.maxLabel || "", layout.trackEndX, controlLayout.trackY + 24);
						menuCtx.textBaseline = "top";
						menuCtx.textAlign = "left";
					}
				}
				if (section.statusText) {
					menuCtx.textAlign = "center";
					menuCtx.fillStyle = section.statusTone === "warning" ? "rgba(255,160,160,0.9)" : "rgba(255,255,255,0.68)";
					menuCtx.font = "18px Arial";
					menuCtx.textBaseline = "top";
					menuCtx.fillText(section.statusText, layout.centerX, sectionLayout.statusY);
					menuCtx.textAlign = "left";
				}
			};
			for (let i = 0; i < moduleSections.length; i += 1) {
				drawDynamicSection(moduleSections[i]);
			}
			menuCtx.setTransform(1, 0, 0, 1, 0, 0);
			return menuCanvas;
		},
		updateDesktopPreview: function(previewState) {
			previewState = previewState || {};
			if (!previewState.visibleBool) {
				previewCanvas.style.display = "none";
				return;
			}
			this.render(previewState.renderState);
			previewCanvas.style.display = "block";
			previewCanvas.style.pointerEvents = previewState.interactiveBool ? "auto" : "none";
			previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
			previewCtx.drawImage(menuCanvas, 0, 0);
		}
	};
};

// core/menu-controller.js
const createMenuController = function(options) {
	const menuView = options.menuView;
	const buildModuleSections = options.buildModuleSections || createLowerMenuSections;
	const menuCanvas = menuView.menuCanvas;
	const previewCanvas = menuView.previewCanvas;
	const windowRef = options.windowRef || window;
	const passthroughController = options.passthroughController || null;
	const menuEventRegistry = createEventListenerRegistry();
	const controllerRays = [];
	const triggerPressedByHand = new Map();
	const state = {
		jumpMode: options.initialJumpMode || "double",
		menuOpenBool: false,
		menuTogglePressedBool: false,
		floorAlpha: options.initialFloorAlpha == null ? 0.72 : options.initialFloorAlpha,
		eyeDistanceMeters: options.initialEyeDistanceMeters == null ? 0.064 : options.initialEyeDistanceMeters,
		activeSliderHand: "",
		activeFloorAlphaSliderHand: "",
		activeMenuSliderControlKeyByHand: {},
		eyeDistanceHoverBool: false,
		floorAlphaHoverBool: false,
		hoveredMenuSliderControlKeys: {},
		hoveredPassthroughToggle: "",
		hoveredSceneLightingModeAction: "",
		hoveredMixModeKey: "",
		hoveredJumpMode: "",
		hoveredExitVrBool: false,
		hoveredShaderModeAction: "",
		hoveredHorizontalMirrorBool: false,
		hoveredLightPresetAction: "",
		hoveredLightPresetVariantAction: "",
		hoveredEffectSemanticModeAction: "",
		hoveredPresetAction: "",
		xrSessionActiveBool: false,
		desktopPreviewVisibleBool: options.initialDesktopPreviewVisibleBool !== false,
		desktopPointerActiveBool: false,
		desktopPointerU: 0,
		desktopPointerV: 0,
		desktopPreviewEventsRegisteredBool: false,
		cachedSceneLightingState: {
			lightPresetNames: ["Aurora Drift"],
			currentLightPresetIndex: 0,
			currentLightPresetName: "Aurora Drift",
			currentLightPresetDescription: "Slow colorful overhead drift",
			currentLightPresetEffectDescription: "Slow colorful overhead drift",
			currentLightPresetEffectName: "Aurora Drift",
			currentLightPresetEffectIndex: 0,
			currentLightPresetEffectCount: 1,
			currentLightPresetVariantKey: "",
			currentLightPresetVariantIndex: 0,
			currentLightPresetVariantCount: 1,
			currentLightPresetVariantLabel: "",
			currentLightPresetSurfaceKey: "",
			effectSemanticModeKey: PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
			effectSemanticModeLabel: "Current"
		}
	};
	const menuPlane = {
		center: {x: 0, y: 1.45, z: -0.8},
		right: {x: 1, y: 0, z: 0},
		up: {x: 0, y: 1, z: 0},
		normal: {x: 0, y: 0, z: 1}
	};
	const getPassthroughUiState = function() {
		return passthroughController && passthroughController.getUiState ? passthroughController.getUiState() : {
			availableBool: false,
			fallbackBool: true,
			statusText: "Passthrough unsupported, using black fallback",
			mixModes: backgroundMixModeDefinitions,
			selectedMixModeKey: "manual",
			mixModeVisibleBool: true,
			backgroundControls: [],
			flashlightActiveBool: false,
			depthActiveBool: false,
			usableDepthAvailableBool: false,
			passthroughControls: [],
			lightingModes: passthroughLightingModeDefinitions,
			selectedLightingModeKey: "uniform",
			lightingControls: [],
			effectSemanticControls: [],
			visibleShare: 0
		};
	};
	const updateCachedSceneLightingState = function(externalState) {
		externalState = externalState || {};
		if (externalState.lightPresetNames && externalState.lightPresetNames.length) {
			state.cachedSceneLightingState = {
				lightPresetNames: externalState.lightPresetNames,
				currentLightPresetIndex: externalState.currentLightPresetIndex || 0,
				currentLightPresetName: externalState.currentLightPresetName || "",
				currentLightPresetDescription: externalState.currentLightPresetDescription || "",
				currentLightPresetEffectDescription: externalState.currentLightPresetEffectDescription || externalState.currentLightPresetDescription || "",
				currentLightPresetEffectName: externalState.currentLightPresetEffectName || externalState.currentLightPresetName || "",
				currentLightPresetEffectIndex: externalState.currentLightPresetEffectIndex || 0,
				currentLightPresetEffectCount: externalState.currentLightPresetEffectCount || 1,
				currentLightPresetVariantKey: externalState.currentLightPresetVariantKey || "",
				currentLightPresetVariantIndex: externalState.currentLightPresetVariantIndex || 0,
				currentLightPresetVariantCount: externalState.currentLightPresetVariantCount || 1,
				currentLightPresetVariantLabel: externalState.currentLightPresetVariantLabel || "",
				currentLightPresetSurfaceKey: externalState.currentLightPresetSurfaceKey || "",
				effectSemanticModeKey: externalState.effectSemanticModeKey || PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
				effectSemanticModeLabel: externalState.effectSemanticModeLabel || "Current"
			};
		}
	};
	const getMenuSliderControls = function(passthroughUiState) {
		passthroughUiState = passthroughUiState || {};
		return (passthroughUiState.backgroundControls || [])
			.concat(passthroughUiState.passthroughControls || [])
			.concat(passthroughUiState.lightingControls || [])
			.concat(passthroughUiState.effectSemanticControls || []);
	};
	const getMenuSliderControlByKey = function(passthroughUiState, controlKey) {
		const controls = getMenuSliderControls(passthroughUiState);
		for (let i = 0; i < controls.length; i += 1) {
			if (controls[i].key === controlKey) {
				return controls[i];
			}
		}
		return null;
	};
	const getActiveMenuSliderControlKey = function(hand) {
		return state.activeMenuSliderControlKeyByHand[hand] || "";
	};
	const setActiveMenuSliderControlKey = function(hand, controlKey) {
		if (!hand) {
			return;
		}
		if (controlKey) {
			state.activeMenuSliderControlKeyByHand[hand] = controlKey;
			return;
		}
		delete state.activeMenuSliderControlKeyByHand[hand];
	};
	const isMenuSliderControlActive = function(controlKey) {
		if (!controlKey) {
			return false;
		}
		const hands = Object.keys(state.activeMenuSliderControlKeyByHand);
		for (let i = 0; i < hands.length; i += 1) {
			if (state.activeMenuSliderControlKeyByHand[hands[i]] === controlKey) {
				return true;
			}
		}
		return false;
	};
	const setMenuSliderHover = function(controlKey) {
		if (controlKey) {
			state.hoveredMenuSliderControlKeys[controlKey] = true;
		}
	};
	// The controller only gathers runtime state and delegates section creation.
	const getModuleSections = function(externalState) {
		updateCachedSceneLightingState(externalState);
		const passthroughUiState = getPassthroughUiState();
		const lightingState = state.cachedSceneLightingState;
		const lightPresetNames = lightingState.lightPresetNames || ["Aurora Drift"];
		const lightPresetIndex = clampNumber(lightingState.currentLightPresetIndex || 0, 0, Math.max(0, lightPresetNames.length - 1));
		externalState = externalState || {};
		const shaderModeNames = externalState.shaderModeNames && externalState.shaderModeNames.length ? externalState.shaderModeNames : ["No mode"];
		const currentShaderModeIndex = clampNumber(externalState.currentShaderModeIndex || 0, 0, shaderModeNames.length - 1);
		const presetNames = externalState.presetNames && externalState.presetNames.length ? externalState.presetNames : ["No preset"];
		const currentPresetIndex = clampNumber(externalState.currentPresetIndex || 0, 0, presetNames.length - 1);
		const xrSessionActiveBool = externalState.xrSessionActiveBool == null ? state.xrSessionActiveBool : !!externalState.xrSessionActiveBool;
		const createMenuSliderState = function(control) {
			return {
				control: control,
				sliderU: getControlSliderU(control),
				hoveredBool: !!state.hoveredMenuSliderControlKeys[control.key],
				activeBool: isMenuSliderControlActive(control.key)
			};
		};
		const backgroundControls = (passthroughUiState.backgroundControls || []).map(createMenuSliderState);
		const passthroughControls = (passthroughUiState.passthroughControls || []).map(createMenuSliderState);
		const sceneLightingControls = (passthroughUiState.lightingControls || []).map(createMenuSliderState);
		const effectSemanticControls = (passthroughUiState.effectSemanticControls || []).map(createMenuSliderState);
		return buildModuleSections({
			selectedJumpMode: state.jumpMode,
			hoveredJumpMode: state.hoveredJumpMode,
			hoveredExitVrBool: state.hoveredExitVrBool,
			floorAlpha: state.floorAlpha,
			floorAlphaSliderU: floorAlphaSlider.toSliderU(state.floorAlpha),
			floorAlphaHoverBool: state.floorAlphaHoverBool,
			floorAlphaActiveBool: !!state.activeFloorAlphaSliderHand,
			passthroughUiState: passthroughUiState,
			backgroundControls: backgroundControls,
			passthroughControls: passthroughControls,
			hoveredMixModeKey: state.hoveredMixModeKey,
			hoveredPassthroughToggle: state.hoveredPassthroughToggle,
			eyeDistanceMeters: state.eyeDistanceMeters,
			eyeDistanceMin: options.eyeDistanceMin,
			eyeDistanceMax: options.eyeDistanceMax,
			eyeDistanceSliderU: eyeDistanceSlider.toSliderU(state.eyeDistanceMeters),
			eyeDistanceHoverBool: state.eyeDistanceHoverBool,
			eyeDistanceActiveBool: !!state.activeSliderHand,
			currentShaderModeName: shaderModeNames[currentShaderModeIndex],
			shaderModeMetaText: (currentShaderModeIndex + 1) + " / " + shaderModeNames.length,
			horizontalMirrorBool: !!externalState.horizontalMirrorBool,
			hoveredShaderModeAction: state.hoveredShaderModeAction,
			hoveredHorizontalMirrorBool: state.hoveredHorizontalMirrorBool,
			lightingModes: passthroughUiState.lightingModes || [],
			selectedLightingModeKey: passthroughUiState.selectedLightingModeKey,
			hoveredSceneLightingModeAction: state.hoveredSceneLightingModeAction,
			lightPresetNames: lightPresetNames,
			currentLightPresetIndex: lightPresetIndex,
			currentLightPresetName: lightingState.currentLightPresetName || lightPresetNames[lightPresetIndex] || "Aurora Drift",
			currentLightPresetDescription: lightingState.currentLightPresetDescription || "",
			currentLightPresetEffectDescription: lightingState.currentLightPresetEffectDescription || lightingState.currentLightPresetDescription || "",
			currentLightPresetEffectName: lightingState.currentLightPresetEffectName || lightingState.currentLightPresetName || lightPresetNames[lightPresetIndex] || "Aurora Drift",
			currentLightPresetEffectIndex: lightingState.currentLightPresetEffectIndex || 0,
			currentLightPresetEffectCount: lightingState.currentLightPresetEffectCount || 1,
			currentLightPresetVariantKey: lightingState.currentLightPresetVariantKey || "",
			currentLightPresetVariantIndex: lightingState.currentLightPresetVariantIndex || 0,
			currentLightPresetVariantCount: lightingState.currentLightPresetVariantCount || 1,
			currentLightPresetVariantLabel: lightingState.currentLightPresetVariantLabel || "",
			currentLightPresetSurfaceKey: lightingState.currentLightPresetSurfaceKey || "",
			hoveredLightPresetAction: state.hoveredLightPresetAction,
			hoveredLightPresetVariantAction: state.hoveredLightPresetVariantAction,
			effectSemanticModeKey: lightingState.effectSemanticModeKey || PASSTHROUGH_EFFECT_SEMANTIC_MODE_CURRENT,
			effectSemanticModeLabel: lightingState.effectSemanticModeLabel || "Current",
			hoveredEffectSemanticModeAction: state.hoveredEffectSemanticModeAction,
			sceneLightingControls: sceneLightingControls,
			effectSemanticControls: effectSemanticControls,
			currentPresetName: presetNames[currentPresetIndex],
			presetMetaText: (currentPresetIndex + 1) + " / " + presetNames.length,
			hoveredPresetAction: state.hoveredPresetAction,
			audioSourceKind: externalState.audioSourceKind || "none",
			audioSourceName: externalState.audioSourceName || "",
			xrSessionActiveBool: xrSessionActiveBool
		});
	};
	const createSliderMapping = function(minValue, maxValue) {
		return {
			toSliderU: function(value) {
				return options.menuSliderMinU + (clampNumber(value, minValue, maxValue) - minValue) / (maxValue - minValue) * (options.menuSliderMaxU - options.menuSliderMinU);
			},
			fromSliderU: function(u) {
				return minValue + clampNumber((u - options.menuSliderMinU) / (options.menuSliderMaxU - options.menuSliderMinU), 0, 1) * (maxValue - minValue);
			}
		};
	};
	const eyeDistanceSlider = createSliderMapping(options.eyeDistanceMin, options.eyeDistanceMax);
	const floorAlphaSlider = createSliderMapping(options.floorAlphaMin, options.floorAlphaMax);
	const getControlSliderU = function(control) {
		if (!control) {
			return eyeDistanceSlider.toSliderU(options.eyeDistanceMin);
		}
		return options.menuSliderMinU + (clampNumber(control.value, control.min, control.max) - control.min) / (control.max - control.min) * (options.menuSliderMaxU - options.menuSliderMinU);
	};
	const getControlValueFromSliderU = function(control, u) {
		return control.min + clampNumber((u - options.menuSliderMinU) / (options.menuSliderMaxU - options.menuSliderMinU), 0, 1) * (control.max - control.min);
	};
	const clearHoverState = function() {
		state.eyeDistanceHoverBool = false;
		state.floorAlphaHoverBool = false;
		state.hoveredMenuSliderControlKeys = {};
		state.hoveredPassthroughToggle = "";
		state.hoveredSceneLightingModeAction = "";
		state.hoveredMixModeKey = "";
		state.hoveredJumpMode = "";
		state.hoveredExitVrBool = false;
		state.hoveredShaderModeAction = "";
		state.hoveredHorizontalMirrorBool = false;
		state.hoveredLightPresetAction = "";
		state.hoveredLightPresetVariantAction = "";
		state.hoveredEffectSemanticModeAction = "";
		state.hoveredPresetAction = "";
	};
	const releaseSliderHand = function(hand) {
		if (state.activeSliderHand === hand) {
			state.activeSliderHand = "";
		}
		if (state.activeFloorAlphaSliderHand === hand) {
			state.activeFloorAlphaSliderHand = "";
		}
		setActiveMenuSliderControlKey(hand, "");
	};
	const getCapturedModuleSliderKey = function(hand) {
		if (state.activeSliderHand === hand) {
			return "eyeDistance";
		}
		if (state.activeFloorAlphaSliderHand === hand) {
			return "floorAlpha";
		}
		return getActiveMenuSliderControlKey(hand);
	};
	// Keep raw hover data intact and only promote the captured slider during an active drag.
	const applySliderCaptureState = function(hit, hand) {
		if (!hit) {
			return hit;
		}
		const capturedModuleSliderControlKey = getCapturedModuleSliderKey(hand);
		hit.hoveredModuleSliderControlKey = hit.moduleSliderControlKey || "";
		hit.capturedModuleSliderControlKey = capturedModuleSliderControlKey;
		if (capturedModuleSliderControlKey) {
			hit.moduleSliderControlKey = capturedModuleSliderControlKey;
			hit.moduleCycleControlKey = "";
			hit.moduleCycleAction = "";
			hit.moduleChoiceControlKey = "";
			hit.moduleChoiceItemKey = "";
		}
		return hit;
	};
	const applyPassthroughState = function(args) {
		if (passthroughController && passthroughController.setSessionState) {
			passthroughController.setSessionState(args);
		}
	};
	const applyDesktopHoverState = function(pointerLockedBool, xrSessionActiveBool) {
		const passthroughUiState = getPassthroughUiState();
		const moduleSections = getModuleSections({xrSessionActiveBool: xrSessionActiveBool});
		if (xrSessionActiveBool || !state.desktopPreviewVisibleBool || pointerLockedBool || !state.desktopPointerActiveBool) {
			state.eyeDistanceHoverBool = state.activeSliderHand === "desktop";
			state.floorAlphaHoverBool = state.activeFloorAlphaSliderHand === "desktop";
			state.hoveredMenuSliderControlKeys = {};
			setMenuSliderHover(getActiveMenuSliderControlKey("desktop"));
			state.hoveredPassthroughToggle = "";
			state.hoveredSceneLightingModeAction = "";
			state.hoveredMixModeKey = "";
			state.hoveredJumpMode = "";
			state.hoveredExitVrBool = false;
			state.hoveredShaderModeAction = "";
			state.hoveredHorizontalMirrorBool = false;
			state.hoveredLightPresetAction = "";
			state.hoveredLightPresetVariantAction = "";
			state.hoveredEffectSemanticModeAction = "";
			state.hoveredPresetAction = "";
			return;
		}
		const hit = menuView.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV, moduleSections);
		state.eyeDistanceHoverBool = hit.moduleSliderControlKey === "eyeDistance" || state.activeSliderHand === "desktop";
		state.floorAlphaHoverBool = hit.moduleSliderControlKey === "floorAlpha" || state.activeFloorAlphaSliderHand === "desktop";
		state.hoveredMenuSliderControlKeys = {};
		setMenuSliderHover(hit.moduleSliderControlKey);
		setMenuSliderHover(getActiveMenuSliderControlKey("desktop"));
		state.hoveredPassthroughToggle =
			hit.moduleChoiceControlKey === "passthroughFlashlightToggle" ? "flashlight" :
			(hit.moduleChoiceControlKey === "passthroughDepthToggle" ? "depth" : "");
		state.hoveredSceneLightingModeAction = hit.moduleCycleControlKey === "sceneLightingMode" ? hit.moduleCycleAction : "";
		state.hoveredMixModeKey = hit.moduleChoiceControlKey === "backgroundMixMode" ? hit.moduleChoiceItemKey : "";
		state.hoveredJumpMode = hit.moduleChoiceControlKey === "jumpMode" ? hit.moduleChoiceItemKey : "";
		state.hoveredExitVrBool = hit.moduleChoiceControlKey === "sessionAction" && hit.moduleChoiceItemKey === "exitVr";
		state.hoveredShaderModeAction = hit.moduleCycleControlKey === "visualizerMode" ? hit.moduleCycleAction : "";
		state.hoveredHorizontalMirrorBool = hit.moduleChoiceControlKey === "visualizerHorizontalMirror";
		state.hoveredLightPresetAction = hit.moduleCycleControlKey === "sceneLightPreset" ? hit.moduleCycleAction : "";
		state.hoveredLightPresetVariantAction = hit.moduleCycleControlKey === "sceneLightVariant" ? hit.moduleCycleAction : "";
		state.hoveredEffectSemanticModeAction = hit.moduleCycleControlKey === "effectSemanticMode" ? hit.moduleCycleAction : "";
		state.hoveredPresetAction = hit.moduleCycleControlKey === "butterchurnPreset" ? hit.moduleCycleAction : "";
		if (state.activeSliderHand === "desktop") {
			state.eyeDistanceMeters = eyeDistanceSlider.fromSliderU(state.desktopPointerU);
		}
		if (state.activeFloorAlphaSliderHand === "desktop") {
			state.floorAlpha = floorAlphaSlider.fromSliderU(state.desktopPointerU);
		}
		const activeMenuSliderControl = getMenuSliderControlByKey(passthroughUiState, getActiveMenuSliderControlKey("desktop"));
		if (activeMenuSliderControl && passthroughController && passthroughController.setControlValue) {
			passthroughController.setControlValue(activeMenuSliderControl.key, getControlValueFromSliderU(activeMenuSliderControl, state.desktopPointerU));
		}
	};
	const intersectMenu = function(ray) {
		if (!state.menuOpenBool) {
			return null;
		}
		const passthroughUiState = getPassthroughUiState();
		const moduleSections = getModuleSections();
		const planeDimensions = menuView.getPlaneDimensions(moduleSections);
		const denom = dotVec3(menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z, ray.dir.x, ray.dir.y, ray.dir.z);
		if (Math.abs(denom) < 0.0001) {
			return null;
		}
		const distance = dotVec3(menuPlane.center.x - ray.origin.x, menuPlane.center.y - ray.origin.y, menuPlane.center.z - ray.origin.z, menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z) / denom;
		if (distance <= 0 || distance > options.rayLength) {
			return null;
		}
		const point = {x: ray.origin.x + ray.dir.x * distance, y: ray.origin.y + ray.dir.y * distance, z: ray.origin.z + ray.dir.z * distance};
		const relX = point.x - menuPlane.center.x;
		const relY = point.y - menuPlane.center.y;
		const relZ = point.z - menuPlane.center.z;
		const localX = dotVec3(relX, relY, relZ, menuPlane.right.x, menuPlane.right.y, menuPlane.right.z);
		const localY = dotVec3(relX, relY, relZ, menuPlane.up.x, menuPlane.up.y, menuPlane.up.z);
		const u = 0.5 + localX / planeDimensions.width;
		const v = 0.5 - localY / planeDimensions.height;
		if (Math.abs(localX) > planeDimensions.width * 0.5 || Math.abs(localY) > planeDimensions.height * 0.5) {
			if (state.activeSliderHand !== ray.hand && state.activeFloorAlphaSliderHand !== ray.hand && !getActiveMenuSliderControlKey(ray.hand)) {
				return null;
			}
			return {
				distance: distance,
				point: point,
				u: clampNumber(u, 0, 1),
				v: clampNumber(v, 0, 1),
				hoveredModuleSliderControlKey: "",
				capturedModuleSliderControlKey: getCapturedModuleSliderKey(ray.hand),
				moduleCycleControlKey: "",
				moduleCycleAction: "",
				moduleChoiceControlKey: "",
				moduleChoiceItemKey: "",
				moduleSliderControlKey: getCapturedModuleSliderKey(ray.hand)
			};
		}
		return applySliderCaptureState(Object.assign({distance: distance, point: point, u: u, v: v}, menuView.getInteractionAtUv(u, v, moduleSections)), ray.hand);
	};
	const updateControllerRays = function(frame, xrSession, xrRefSpace) {
		controllerRays.length = 0;
		clearHoverState();
		if (!xrSession || !xrRefSpace) {
			return;
		}
		const sources = xrSession.inputSources || [];
		for (let i = 0; i < sources.length; i += 1) {
			const source = sources[i];
			if (!source || source.targetRayMode !== "tracked-pointer") {
				continue;
			}
			const pose = frame.getPose(source.targetRaySpace, xrRefSpace);
			if (!pose) {
				continue;
			}
			const ray = {
				hand: source.handedness || "none",
				source: source,
				origin: {x: pose.transform.position.x, y: pose.transform.position.y, z: pose.transform.position.z},
				dir: extractForwardDirectionFromQuaternion(pose.transform.orientation),
				length: options.rayLength,
				hitBool: false,
				hitPoint: null,
				hit: null
			};
			const hit = intersectMenu(ray);
			if (hit) {
				ray.length = hit.distance;
				ray.hitBool = true;
				ray.hitPoint = hit.point;
				ray.hit = hit;
				state.eyeDistanceHoverBool = hit.moduleSliderControlKey === "eyeDistance" || state.eyeDistanceHoverBool;
				state.floorAlphaHoverBool = hit.moduleSliderControlKey === "floorAlpha" || state.floorAlphaHoverBool;
				setMenuSliderHover(hit.moduleSliderControlKey);
				state.hoveredPassthroughToggle =
					hit.moduleChoiceControlKey === "passthroughFlashlightToggle" ? "flashlight" :
					(hit.moduleChoiceControlKey === "passthroughDepthToggle" ? "depth" : state.hoveredPassthroughToggle);
				state.hoveredSceneLightingModeAction = hit.moduleCycleControlKey === "sceneLightingMode" ? hit.moduleCycleAction : state.hoveredSceneLightingModeAction;
				state.hoveredMixModeKey = hit.moduleChoiceControlKey === "backgroundMixMode" ? hit.moduleChoiceItemKey : state.hoveredMixModeKey;
				state.hoveredJumpMode = hit.moduleChoiceControlKey === "jumpMode" ? hit.moduleChoiceItemKey : state.hoveredJumpMode;
				state.hoveredExitVrBool = (hit.moduleChoiceControlKey === "sessionAction" && hit.moduleChoiceItemKey === "exitVr") || state.hoveredExitVrBool;
				state.hoveredShaderModeAction = hit.moduleCycleControlKey === "visualizerMode" ? hit.moduleCycleAction : state.hoveredShaderModeAction;
				state.hoveredHorizontalMirrorBool = (hit.moduleChoiceControlKey === "visualizerHorizontalMirror") || state.hoveredHorizontalMirrorBool;
				state.hoveredLightPresetAction = hit.moduleCycleControlKey === "sceneLightPreset" ? hit.moduleCycleAction : state.hoveredLightPresetAction;
				state.hoveredLightPresetVariantAction = hit.moduleCycleControlKey === "sceneLightVariant" ? hit.moduleCycleAction : state.hoveredLightPresetVariantAction;
				state.hoveredEffectSemanticModeAction = hit.moduleCycleControlKey === "effectSemanticMode" ? hit.moduleCycleAction : state.hoveredEffectSemanticModeAction;
				state.hoveredPresetAction = hit.moduleCycleControlKey === "butterchurnPreset" ? hit.moduleCycleAction : state.hoveredPresetAction;
			}
			controllerRays.push(ray);
		}
	};
	return {
		getState: function() {
			const moduleSections = getModuleSections();
			let rightRayHitsMenuBool = false;
			for (let i = 0; i < controllerRays.length; i += 1) {
				if (controllerRays[i].hand === "right" && controllerRays[i].hitBool) {
					rightRayHitsMenuBool = true;
					break;
				}
			}
			return {
				jumpMode: state.jumpMode,
				menuOpenBool: state.menuOpenBool,
				menuConsumesRightTriggerBool: state.menuOpenBool && (rightRayHitsMenuBool || state.activeSliderHand === "right" || state.activeFloorAlphaSliderHand === "right" || !!getActiveMenuSliderControlKey("right")),
				floorAlpha: state.floorAlpha,
				eyeDistanceMeters: state.eyeDistanceMeters,
				desktopPreviewVisibleBool: state.desktopPreviewVisibleBool,
				plane: menuPlane,
				planeWidth: menuView.getPlaneDimensions(moduleSections).width,
				planeHeight: menuView.getPlaneDimensions(moduleSections).height
			};
		},
		getControllerRays: function() {
			return controllerRays;
		},
		getRenderState: function(externalState) {
			externalState = externalState || {};
			const moduleSections = getModuleSections(externalState);
			return {
				sceneTimeSeconds: externalState.sceneTimeSeconds,
				audioMetrics: externalState.audioMetrics,
				jumpMode: state.jumpMode,
				hoveredJumpMode: state.hoveredJumpMode,
				hoveredExitVrBool: state.hoveredExitVrBool,
				hoveredShaderModeAction: state.hoveredShaderModeAction,
				hoveredPresetAction: state.hoveredPresetAction,
				floorAlpha: state.floorAlpha,
				eyeDistanceMeters: state.eyeDistanceMeters,
				floorAlphaHoverBool: state.floorAlphaHoverBool,
				eyeDistanceHoverBool: state.eyeDistanceHoverBool,
				floorAlphaSliderActiveBool: !!state.activeFloorAlphaSliderHand,
				eyeDistanceSliderActiveBool: !!state.activeSliderHand,
				moduleSections: moduleSections,
				shaderModeNames: externalState.shaderModeNames,
				currentShaderModeIndex: externalState.currentShaderModeIndex,
				presetNames: externalState.presetNames,
				currentPresetIndex: externalState.currentPresetIndex,
				eyeDistanceMin: options.eyeDistanceMin,
				eyeDistanceMax: options.eyeDistanceMax,
				eyeDistanceSliderU: eyeDistanceSlider.toSliderU(state.eyeDistanceMeters),
				floorAlphaSliderU: floorAlphaSlider.toSliderU(state.floorAlpha)
			};
		},
		setPassthroughState: function(args) {
			applyPassthroughState(args);
		},
		updateMenuPose: function(pose) {
			if (!pose) {
				return;
			}
			const matrix = pose.transform.matrix;
			const forward = normalizeVec3(-matrix[8], 0, -matrix[10]);
			menuPlane.normal.x = -forward.x;
			menuPlane.normal.y = 0;
			menuPlane.normal.z = -forward.z;
			menuPlane.right.x = menuPlane.normal.z;
			menuPlane.right.y = 0;
			menuPlane.right.z = -menuPlane.normal.x;
			menuPlane.up.x = 0;
			menuPlane.up.y = 1;
			menuPlane.up.z = 0;
			menuPlane.center.x = matrix[12] + forward.x * 0.8;
			menuPlane.center.y = matrix[13] - 0.03;
			menuPlane.center.z = matrix[14] + forward.z * 0.8;
		},
		renderTexture: function(gl, menuTexture, externalState) {
			menuView.render(this.getRenderState(externalState));
			gl.bindTexture(gl.TEXTURE_2D, menuTexture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, menuCanvas);
		},
		updateDesktopPreview: function(args) {
			args = args || {};
			state.xrSessionActiveBool = !!args.xrSessionActiveBool;
			applyDesktopHoverState(args.pointerLockedBool, args.xrSessionActiveBool);
			menuView.updateDesktopPreview({visibleBool: state.desktopPreviewVisibleBool, interactiveBool: !!args.interactiveBool, renderState: this.getRenderState(args.renderState)});
		},
		updateDesktopPointerFromEvent: function(event) {
			const rect = previewCanvas.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				return null;
			}
			state.desktopPointerU = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
			state.desktopPointerV = clampNumber((event.clientY - rect.top) / rect.height, 0, 1);
			state.desktopPointerActiveBool = true;
			return menuView.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV, getModuleSections({xrSessionActiveBool: state.xrSessionActiveBool}));
		},
		registerDesktopPreviewEvents: function(args) {
			args = args || {};
			if (state.desktopPreviewEventsRegisteredBool) {
				return;
			}
			const controller = this;
			const callbacks = args.callbacks || {};
			const getInteractionState = args.getInteractionState || function() { return {}; };
			menuEventRegistry.on(previewCanvas, "mousemove", function(event) {
				controller.handleDesktopPointerMove(event, getInteractionState());
			});
			menuEventRegistry.on(previewCanvas, "mouseleave", function() {
				controller.handleDesktopPointerLeave();
			});
			menuEventRegistry.on(previewCanvas, "mousedown", function(event) {
				if (controller.handleDesktopPointerDown(event, callbacks, getInteractionState())) {
					event.preventDefault();
				}
			});
			menuEventRegistry.on(previewCanvas, "mouseup", function() {
				controller.handleDesktopPointerUp();
			});
			menuEventRegistry.on(windowRef, "mousemove", function(event) {
				if (getCapturedModuleSliderKey("desktop")) {
					controller.handleDesktopPointerMove(event, getInteractionState());
				}
			});
			menuEventRegistry.on(windowRef, "mouseup", function() {
				controller.handleDesktopPointerUp();
			});
			state.desktopPreviewEventsRegisteredBool = true;
		},
		handleDesktopPointerMove: function(event, args) {
			args = args || {};
			if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
				return null;
			}
			return this.updateDesktopPointerFromEvent(event);
		},
		handleDesktopPointerLeave: function() {
			if (state.activeSliderHand === "desktop" || state.activeFloorAlphaSliderHand === "desktop" || !!getActiveMenuSliderControlKey("desktop")) {
				return;
			}
			this.clearDesktopPointerState();
		},
		handleDesktopPointerDown: function(event, callbacks, args) {
			args = args || {};
			callbacks = callbacks || {};
			if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
				return false;
			}
			const hit = this.updateDesktopPointerFromEvent(event);
			if (!hit) {
				return false;
			}
			const passthroughUiState = getPassthroughUiState();
			if (hit.moduleChoiceControlKey === "jumpMode" && hit.moduleChoiceItemKey) {
				state.jumpMode = hit.moduleChoiceItemKey;
			}
			if (hit.moduleChoiceControlKey === "sessionAction" && hit.moduleChoiceItemKey === "exitVr" && callbacks.onExitVrAction) {
				callbacks.onExitVrAction();
			}
			if (hit.moduleCycleControlKey === "visualizerMode" && callbacks.onShaderModeAction) {
				callbacks.onShaderModeAction(hit.moduleCycleAction === "prev" ? -1 : 1);
			}
			if (hit.moduleChoiceControlKey === "visualizerHorizontalMirror" && callbacks.onHorizontalMirrorToggle) {
				callbacks.onHorizontalMirrorToggle();
			}
			if (hit.moduleCycleControlKey === "butterchurnPreset" && callbacks.onPresetAction) {
				callbacks.onPresetAction(hit.moduleCycleAction === "prev" ? -1 : 1);
			}
			if (hit.moduleChoiceControlKey === "passthroughFlashlightToggle" && passthroughController && passthroughController.toggleFlashlight) {
				passthroughController.toggleFlashlight();
			}
			if (hit.moduleChoiceControlKey === "passthroughDepthToggle" && passthroughController && passthroughController.toggleDepth) {
				passthroughController.toggleDepth();
			}
			if (hit.moduleCycleControlKey === "sceneLightingMode" && passthroughController && passthroughController.cycleLightingMode) {
				passthroughController.cycleLightingMode(hit.moduleCycleAction === "prev" ? -1 : 1);
			}
			if (hit.moduleCycleControlKey === "sceneLightPreset" && callbacks.onLightPresetAction) {
				callbacks.onLightPresetAction(hit.moduleCycleAction === "prev" ? -1 : 1);
			}
			if (hit.moduleCycleControlKey === "sceneLightVariant" && callbacks.onLightPresetVariantAction) {
				callbacks.onLightPresetVariantAction(hit.moduleCycleAction === "prev" ? -1 : 1);
			}
			if (hit.moduleCycleControlKey === "effectSemanticMode" && callbacks.onEffectSemanticModeAction) {
				callbacks.onEffectSemanticModeAction(hit.moduleCycleAction === "prev" ? -1 : 1);
			}
			if (hit.moduleChoiceControlKey === "backgroundMixMode" && passthroughController && passthroughController.selectMixMode) {
				passthroughController.selectMixMode(hit.moduleChoiceItemKey);
			}
			if (hit.moduleSliderControlKey === "eyeDistance") {
				state.activeSliderHand = "desktop";
				setActiveMenuSliderControlKey("desktop", "");
				state.activeFloorAlphaSliderHand = "";
				state.eyeDistanceMeters = eyeDistanceSlider.fromSliderU(state.desktopPointerU);
			}
			if (hit.moduleSliderControlKey === "floorAlpha") {
				state.activeFloorAlphaSliderHand = "desktop";
				setActiveMenuSliderControlKey("desktop", "");
				state.activeSliderHand = "";
				state.floorAlpha = floorAlphaSlider.fromSliderU(state.desktopPointerU);
			}
			const menuSliderControl = getMenuSliderControlByKey(passthroughUiState, hit.moduleSliderControlKey);
			if (menuSliderControl && passthroughController && passthroughController.setControlValue) {
				state.activeSliderHand = "";
				state.activeFloorAlphaSliderHand = "";
				setActiveMenuSliderControlKey("desktop", menuSliderControl.key);
				passthroughController.setControlValue(menuSliderControl.key, getControlValueFromSliderU(menuSliderControl, state.desktopPointerU));
			}
			return true;
		},
		handleDesktopPointerUp: function() {
			releaseSliderHand("desktop");
		},
		clearDesktopPointerState: function() {
			state.desktopPointerActiveBool = false;
			state.desktopPointerU = 0;
			state.desktopPointerV = 0;
			clearHoverState();
			releaseSliderHand("desktop");
		},
		setDesktopPreviewVisibleBool: function(visibleBool) {
			state.desktopPreviewVisibleBool = !!visibleBool;
			if (!state.desktopPreviewVisibleBool) {
				this.clearDesktopPointerState();
				applyStyles(previewCanvas, {display: "none"});
				return;
			}
			applyStyles(previewCanvas, {display: "block"});
		},
		resetSessionState: function() {
			state.xrSessionActiveBool = false;
			state.menuOpenBool = false;
			state.menuTogglePressedBool = false;
			state.activeSliderHand = "";
			state.activeFloorAlphaSliderHand = "";
			state.activeMenuSliderControlKeyByHand = {};
			clearHoverState();
			controllerRays.length = 0;
			triggerPressedByHand.clear();
		},
		endSession: function() {
			state.xrSessionActiveBool = false;
			state.menuOpenBool = false;
			state.menuTogglePressedBool = false;
			state.activeSliderHand = "";
			state.activeFloorAlphaSliderHand = "";
			state.activeMenuSliderControlKeyByHand = {};
			clearHoverState();
			controllerRays.length = 0;
			triggerPressedByHand.clear();
		},
		destroy: function() {
			menuEventRegistry.removeAll();
			controllerRays.length = 0;
			triggerPressedByHand.clear();
		},
		updateXrInput: function(args) {
			args = args || {};
			state.xrSessionActiveBool = !!args.xrSession;
			const callbacks = args.callbacks || {};
			const sources = args.xrSession ? args.xrSession.inputSources || [] : [];
			let togglePressedBool = false;
			for (let i = 0; i < sources.length; i += 1) {
				const gamepad = sources[i].gamepad;
				// Quest maps button 5 to left Y and right B.
				if (gamepad && gamepad.buttons && gamepad.buttons[5] && gamepad.buttons[5].pressed) {
					togglePressedBool = true;
				}
			}
			if (togglePressedBool && !state.menuTogglePressedBool) {
				state.menuOpenBool = !state.menuOpenBool;
				state.activeSliderHand = "";
				state.activeFloorAlphaSliderHand = "";
				state.activeMenuSliderControlKeyByHand = {};
				clearHoverState();
				if (state.menuOpenBool) {
					this.updateMenuPose(args.pose);
				} else {
					controllerRays.length = 0;
					triggerPressedByHand.clear();
				}
			}
			state.menuTogglePressedBool = togglePressedBool;
			updateControllerRays(args.frame, args.xrSession, args.xrRefSpace);
			const handsWithRays = new Set();
			for (let i = 0; i < controllerRays.length; i += 1) {
				handsWithRays.add(controllerRays[i].hand);
			}
			for (const hand of triggerPressedByHand.keys()) {
				if (!handsWithRays.has(hand)) {
					releaseSliderHand(hand);
					triggerPressedByHand.set(hand, false);
				}
			}
			for (let i = 0; i < controllerRays.length; i += 1) {
				const ray = controllerRays[i];
				const gamepad = ray.source.gamepad;
				const hand = ray.hand;
				const triggerPressedBool = !!(gamepad && gamepad.buttons[0] && gamepad.buttons[0].pressed);
				const wasTriggerPressedBool = triggerPressedByHand.get(hand) || false;
				const passthroughUiState = getPassthroughUiState();
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleChoiceControlKey === "jumpMode" && ray.hit.moduleChoiceItemKey) {
					state.jumpMode = ray.hit.moduleChoiceItemKey;
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleChoiceControlKey === "sessionAction" && ray.hit.moduleChoiceItemKey === "exitVr" && callbacks.onExitVrAction) {
					callbacks.onExitVrAction();
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleCycleControlKey === "visualizerMode" && callbacks.onShaderModeAction) {
					callbacks.onShaderModeAction(ray.hit.moduleCycleAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleChoiceControlKey === "visualizerHorizontalMirror" && callbacks.onHorizontalMirrorToggle) {
					callbacks.onHorizontalMirrorToggle();
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleCycleControlKey === "butterchurnPreset" && callbacks.onPresetAction) {
					callbacks.onPresetAction(ray.hit.moduleCycleAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleChoiceControlKey === "passthroughFlashlightToggle" && passthroughController && passthroughController.toggleFlashlight) {
					passthroughController.toggleFlashlight();
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleChoiceControlKey === "passthroughDepthToggle" && passthroughController && passthroughController.toggleDepth) {
					passthroughController.toggleDepth();
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleCycleControlKey === "sceneLightingMode" && passthroughController && passthroughController.cycleLightingMode) {
					passthroughController.cycleLightingMode(ray.hit.moduleCycleAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleCycleControlKey === "sceneLightPreset" && callbacks.onLightPresetAction) {
					callbacks.onLightPresetAction(ray.hit.moduleCycleAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleCycleControlKey === "sceneLightVariant" && callbacks.onLightPresetVariantAction) {
					callbacks.onLightPresetVariantAction(ray.hit.moduleCycleAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleCycleControlKey === "effectSemanticMode" && callbacks.onEffectSemanticModeAction) {
					callbacks.onEffectSemanticModeAction(ray.hit.moduleCycleAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.moduleChoiceControlKey === "backgroundMixMode" && passthroughController && passthroughController.selectMixMode) {
					passthroughController.selectMixMode(ray.hit.moduleChoiceItemKey);
				}
				if (triggerPressedBool && ray.hit && ray.hit.moduleSliderControlKey === "eyeDistance" && (!wasTriggerPressedBool || state.activeSliderHand === hand)) {
					state.activeSliderHand = hand;
					setActiveMenuSliderControlKey(hand, "");
					if (state.activeFloorAlphaSliderHand === hand) {
						state.activeFloorAlphaSliderHand = "";
					}
					state.eyeDistanceMeters = eyeDistanceSlider.fromSliderU(ray.hit.u);
				}
				if (triggerPressedBool && ray.hit && ray.hit.moduleSliderControlKey === "floorAlpha" && (!wasTriggerPressedBool || state.activeFloorAlphaSliderHand === hand)) {
					state.activeFloorAlphaSliderHand = hand;
					setActiveMenuSliderControlKey(hand, "");
					if (state.activeSliderHand === hand) {
						state.activeSliderHand = "";
					}
					state.floorAlpha = floorAlphaSlider.fromSliderU(ray.hit.u);
				}
				const menuSliderControl = getMenuSliderControlByKey(passthroughUiState, ray.hit && ray.hit.moduleSliderControlKey);
				if (triggerPressedBool && ray.hit && menuSliderControl && passthroughController && passthroughController.setControlValue && (!wasTriggerPressedBool || getActiveMenuSliderControlKey(hand) === menuSliderControl.key)) {
					setActiveMenuSliderControlKey(hand, menuSliderControl.key);
					if (state.activeSliderHand === hand) {
						state.activeSliderHand = "";
					}
					if (state.activeFloorAlphaSliderHand === hand) {
						state.activeFloorAlphaSliderHand = "";
					}
					passthroughController.setControlValue(menuSliderControl.key, getControlValueFromSliderU(menuSliderControl, ray.hit.u));
				}
				if (!triggerPressedBool && wasTriggerPressedBool) {
					releaseSliderHand(hand);
				}
				triggerPressedByHand.set(hand, triggerPressedBool);
			}
		}
	};
};
