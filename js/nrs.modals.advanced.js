/******************************************************************************
 * Copyright © 2013-2016 The Nxt Core Developers.                             *
 * Copyright © 2016-2019 Jelurida IP B.V.                                     *
 *                                                                            *
 * See the LICENSE.txt file at the top-level directory of this distribution   *
 * for licensing information.                                                 *
 *                                                                            *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida B.V.,*
 * no part of this software, including this file, may be copied, modified,    *
 * propagated, or distributed except according to the terms contained in the  *
 * LICENSE.txt file.                                                          *
 *                                                                            *
 * Removal or modification of this copyright notice is prohibited.            *
 *                                                                            *
 ******************************************************************************/

/**
 * @depends {nrs.js}
 * @depends {nrs.modals.js}
 */
var NRS = (function(NRS, $, undefined) {
	var _password;

	NRS.setAdvancedModalPassword = function (password) {
		_password = password;
	};

	NRS.showRawTransactionModal = function(transaction) {
        if (transaction.unsignedTransactionBytes && !transaction.transactionBytes) {
            $("#raw_transaction_modal_unsigned_transaction_bytes").val(transaction.unsignedTransactionBytes);
            NRS.generateQRCode("#raw_transaction_modal_unsigned_bytes_qr_code", transaction.unsignedTransactionBytes, 14);
            $("#raw_transaction_modal_unsigned_transaction_bytes_container").show();
            $("#raw_transaction_modal_unsigned_bytes_qr_code_container").show();
            $("#raw_transaction_broadcast").show();
        } else {
            $("#raw_transaction_modal_unsigned_transaction_bytes_container").hide();
            $("#raw_transaction_modal_unsigned_bytes_qr_code_container").hide();
            $("#raw_transaction_broadcast").hide();
        }

        if (transaction.transactionJSON) {
            var namePrefix;
            if (transaction.transactionBytes) {
                $("#raw_transaction_modal_transaction_json_label").html($.t("signed_transaction_json"));
                namePrefix = "signed";
            } else {
                $("#raw_transaction_modal_transaction_json_label").html($.t("unsigned_transaction_json"));
                namePrefix = "unsigned";
            }
            var unsignedTransactionJson = $("#raw_transaction_modal_transaction_json");
            var jsonStr = JSON.stringify(transaction.transactionJSON, null, 2);
            unsignedTransactionJson.val(jsonStr);
            var downloadLink = $("#raw_transaction_modal_transaction_json_download");
            if (window.URL && NRS.isFileReaderSupported()) {
                var jsonAsBlob = new Blob([jsonStr], {type: 'text/plain'});
                downloadLink.prop('download', namePrefix + '.transaction.' + transaction.transactionJSON.timestamp + '.json');
                try {
                    downloadLink.prop('href', window.URL.createObjectURL(jsonAsBlob));
				} catch(e) {
                    NRS.logConsole("Desktop Application in Java 8 does not support createObjectURL");
                    downloadLink.hide();
				}
            } else {
                downloadLink.hide();
            }
        }

        if (transaction.unsignedTransactionBytes && !transaction.transactionBytes) {
            $('#raw_transaction_modal_signature_reader').hide();
            $("#raw_transaction_modal_signature_container").show();
        } else {
            $("#raw_transaction_modal_signature").val("");
            $("#raw_transaction_modal_signature_container").hide();
        }

		if (transaction.transactionBytes) {
            $("#raw_transaction_modal_transaction_bytes").val(transaction.transactionBytes);
            $("#raw_transaction_modal_transaction_bytes_container").show();
        } else {
            $("#raw_transaction_modal_transaction_bytes_container").hide();
        }

        if (transaction.fullHash) {
            $("#raw_transaction_modal_full_hash").val(transaction.fullHash);
            $("#raw_transaction_modal_full_hash_container").show();
        } else {
            $("#raw_transaction_modal_full_hash_container").hide();
        }

        if (transaction.signatureHash) {
            $("#raw_transaction_modal_signature_hash").val(transaction.signatureHash);
            $("#raw_transaction_modal_signature_hash_container").show();
        } else {
            $("#raw_transaction_modal_signature_hash_container").hide();
        }

        $("#raw_transaction_modal").modal("show");
	};

	NRS.showVoucherModal = function (transaction, signature, publicKey, requestType) {
		var voucher = {};
		voucher.transactionJSON = $.extend(true, {}, transaction.transactionJSON);
		voucher.unsignedTransactionBytes = transaction.unsignedTransactionBytes;
		voucher.signature = signature;
		voucher.publicKey = publicKey;
        voucher.requestType = requestType;
        delete voucher.transactionJSON.height;
        delete voucher.transactionJSON.senderRS;
        delete voucher.transactionJSON.recipientRS;
        delete voucher.transactionJSON.signatureHash;
        delete voucher.transactionJSON.fullHash;
        delete voucher.transactionJSON.signature;

        var jsonStr = JSON.stringify(voucher, null, 2);
        var voucherField = $("#generated_voucher_json");
        voucherField.html(jsonStr);
        hljs.highlightBlock(voucherField[0]);
        var downloadLink = $("#voucher_json_download");
        if (window.URL && NRS.isFileReaderSupported()) {
            var jsonAsBlob = new Blob([jsonStr], {type: 'text/plain'});
            downloadLink.prop("download", "voucher." + Date.now() + ".json");
            try {
                downloadLink.prop('href', window.URL.createObjectURL(jsonAsBlob));
            } catch(e) {
                NRS.logConsole("Desktop Application in Java 8 does not support createObjectURL");
                downloadLink.hide();
            }
        } else {
            downloadLink.hide();
        }
        var qrData = pako.deflate(JSON.stringify(voucher), { to: 'string' });
        NRS.generateQRCode("#voucher_qr_code", qrData, 14);
        $("#generate_voucher_modal").modal("show");
	};


    var loadVoucherModal = $("#load_voucher_modal");
    loadVoucherModal.on("show.bs.modal", function() {
        $(this).find("#voucher_reader").hide();
        $(this).find("#parse_voucher_output").hide();
        $(this).find("#voucher_submit_btn").prop("disabled", true);
        if (!NRS.isFileReaderSupported()) {
            $(this).find(".file-reader-support").hide();
            $(this).find(".info_message").html($.t("voucher_in_desktop_wallet")).show();
        } else {
            $(this).find(".file-reader-support").show();
            $(this).find(".info_message").html("").hide();
        }
        if (!NRS.isVideoSupported()) {
            $(this).find(".video-support").hide();
        }
    });

    loadVoucherModal.on("hidden.bs.modal", function() {
        NRS.stopScanQRCode();
    });

    $('#voucher_json').change(function() {
        var $modal = $(this).closest(".modal");
        $modal.find(".error_message").html("").hide();
        var voucherText = $('#voucher_json').val();
        voucherText = voucherText.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'); // Replace unicode quotes with Ascii ones
        var msg;
        try {
            var voucher = JSON.parse(voucherText);
        } catch (e) {
            msg = $.t("cannot_parse_voucher", { voucher: voucherText });
            $modal.find(".error_message").html(msg).show();
            NRS.logConsole(msg);
            return;
        }
        var transactionJSON = voucher.transactionJSON;
        if (!NRS.verifySignature(voucher.signature, voucher.unsignedTransactionBytes, voucher.publicKey)) {
            msg = $.t("invalid_signature", { signature: voucher.signature, publicKey: voucher.publicKey });
            $modal.find(".error_message").html(msg).show();
            NRS.logConsole(msg);
            return;
        }
        var details = $.extend({}, transactionJSON);
        details = NRS.flattenObject(details, ["version."]);
        details.exchange = details.exchangeChain;
        var result = NRS.verifyTransactionBytes(voucher.unsignedTransactionBytes, voucher.requestType, details, transactionJSON.attachment, false);
        if (result.fail) {
            msg = $.t("cannot_verify_voucher_content", { param: result.param, expected: result.expected, actual: result.actual });
            $modal.find(".error_message").html(msg).show();
            NRS.logConsole(msg);
            return;
        }
        delete transactionJSON.signature;
        delete transactionJSON.senderPublicKey;
        $("#voucher_creator_account").val(NRS.getAccountIdFromPublicKey(voucher.publicKey, true));
        $("#voucher_request_type").val(voucher.requestType);
        var feeNXT = NRS.convertToNXT(voucher.transactionJSON.feeMTA);
        delete voucher.transactionJSON.feeMTA;
        $("#load_voucher_fee").val(feeNXT);
        $("#parse_voucher_output_table").find("tbody").empty().append(NRS.createInfoTable(details));
        $("#parse_voucher_output").show();
        $("#voucher_submit_btn").prop("disabled", false);
    });

    var encryptToSelfAttachmentTemplate = {
        "version.EncryptToSelfMessage": 1,
        "encryptToSelfMessage": {
            "data": "",
            "nonce": "",
            "isText": true,
            "isCompressed": true
        }
    };

    NRS.forms.loadVoucher = function($modal, $btn) {
        var data = NRS.getFormData($modal.find("form:first"));
        if (data.voucher == "") {
            return { error: $.t("no_voucher") };
        }
        var voucherJson = JSON.parse(data.voucher);
        delete data.voucher;
        var transactionJSON = voucherJson.transactionJSON;
        transactionJSON.timestamp = NRS.toEpochTime();
        transactionJSON.deadline = parseInt(data.deadline);
        delete data.deadline;
        var rc = {};
        try {
            NRS.processNoteToSelf(data);
        } catch (e) {
            rc.error = e.message;
            return rc;
        }
        if (data.encryptToSelfMessageData) {
            var attachment = $.extend({}, encryptToSelfAttachmentTemplate);
            attachment.encryptToSelfMessage.data = data.encryptToSelfMessageData;
            attachment.encryptToSelfMessage.nonce = data.encryptToSelfMessageNonce;
            Object.assign(transactionJSON.attachment, attachment);
        }
        transactionJSON.feeMTA = NRS.convertToMTA($("#load_voucher_fee").val());
        data.unsignedTransactionJSON = JSON.stringify(transactionJSON);
        if ($btn.attr("id") == "voucher_submit_btn") {
            if (data.doNotBroadcast) {
                data.broadcast = false;
                delete data.doNotBroadcast;
            } else {
                data.broadcast = true;
            }
            NRS.sendRequest("signTransaction", {
                unsignedTransactionJSON: data.unsignedTransactionJSON,
                secretPhrase: data.secretPhrase,
                broadcast: data.broadcast
            }, function (signResponse) {
                if (NRS.isErrorResponse(signResponse)) {
                    rc.error = NRS.getErrorMessage(signResponse);
                    return;
                }
                if (data.broadcast) {
                    NRS.broadcastTransactionBytes(signResponse.transactionBytes, function (broadcastResponse) {
                        if (NRS.isErrorResponse(broadcastResponse)) {
                            rc.error = NRS.getErrorMessage(broadcastResponse);
                            return;
                        }
                        if (broadcastResponse.fullHash) {
                            NRS.addUnconfirmedTransaction(broadcastResponse.fullHash, function() {
                                NRS.forms.loadVoucherComplete();
                            });
                        }
                    }, signResponse, {});
                } else {
                    NRS.showRawTransactionModal(signResponse);
                }
                rc.stop = true;
            }, {isAsync: false});
        } else if ($btn.hasClass("btn-calculate-fee")) {
            NRS.sendRequest("calculateFee", {
                transactionJSON: data.unsignedTransactionJSON
            }, function (calculateFeeResponse) {
                if (NRS.isErrorResponse(calculateFeeResponse)) {
                    rc.error = NRS.getErrorMessage(calculateFeeResponse);
                    return;
                }
                var feeMTA = calculateFeeResponse.feeMTA;
                var $feeField = $("#" + $modal.attr('id').replace('_modal', '') + "_fee");
                $feeField.val(NRS.convertToNXT(feeMTA));
                rc.stop = true;
                rc.keepOpen = true;
            }, {isAsync: false})
        }
        return rc;
    };

    NRS.forms.loadVoucherComplete = function() {
        $.growl($.t("voucher_processed"));
    };

    $(".qr_code_reader_link").click(function(e) {
        e.preventDefault();
        var id = $(this).attr("id");
        var readerId = id.substring(0, id.lastIndexOf("_"));
        var outputId = readerId.substring(0, readerId.lastIndexOf("_"));
        NRS.scanQRCode(readerId, function(data) {
            $("#" + outputId).val(data);
        });
    });

    $("#voucher_reader_link").click(function(e) {
        e.preventDefault();
        var readerId = "voucher_reader";
        NRS.scanQRCode(readerId, function(data) {
            var jsonStr = pako.inflate(data, { to: 'string' });
            try {
                JSON.parse(jsonStr);
                $("#voucher_json").val(jsonStr).change();
            } catch(e) {
                $("#voucher_json").val($.t("voucher_scan_error"));
            }
        });
    });

    $("#broadcast_transaction_json_file, #unsigned_transaction_json_file, #voucher_json_file").change(function(e) {
        e.preventDefault();
        var fileInputId = $(this).attr('id');
        var textAreaId = fileInputId.substring(0, fileInputId.lastIndexOf("_"));
        var fileInput = document.getElementById(fileInputId);
        var file = fileInput.files[0];
        if (!file) {
            $.growl($.t("select_file_to_upload"));
            return;
        }
        var fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            var textFromFile = fileLoadedEvent.target.result;
            $("#" + textAreaId).val(textFromFile).change();
        };
        fileReader.readAsText(file, "UTF-8");
    });

    NRS.forms.broadcastTransaction = function(modal) {
        // The problem is that broadcastTransaction is invoked by different modals
        // We need to find the correct form in case the modal has more than one
        var data;
        if (modal.attr('id') == "transaction_json_modal") {
            data = NRS.getFormData($("#broadcast_json_form"));
        } else {
            data = NRS.getFormData(modal.find("form:first"));
        }
        if (data.transactionJSON) {
            var signature = data.signature;
            try {
                var transactionJSON = JSON.parse(data.transactionJSON);
            } catch (e) {
                return { errorMessage: "Invalid Transaction JSON" }
            }
            if (!transactionJSON.signature) {
                transactionJSON.signature = signature;
            }
            data.transactionJSON = JSON.stringify(transactionJSON);
            delete data.signature;
        }
        return { data: data };
    };

	NRS.initAdvancedModalFormValues = function($modal) {
		$(".phasing_number_accounts_group").find("input[name=phasingQuorum]").val(1);

		var type = $modal.data('transactionType');
		var subType = $modal.data('transactionSubtype');
		if (type != undefined && subType != undefined) {
			if (NRS.transactionTypes[type]["subTypes"][subType]["serverConstants"]["isPhasingSafe"] == true) {
				$modal.find('.phasing_safe_alert').hide();
			} else {
				$modal.find('.phasing_safe_alert').show();
			}
			if (!NRS.accountInfo.publicKey) {
                $modal.find(".is_voucher").hide();
            } else {
                $modal.find(".is_voucher").show();
            }
		} else {
            var isEnableVoucher = $modal.data('enableVoucher');
            if (isEnableVoucher) {
                $modal.find(".is_voucher").show();
            } else {
                $modal.find(".is_voucher").hide();
            }
        }
        var $feeCalculationBtn = $(".btn-calculate-fee");
        if ($modal.data('disableFeeCalculation')) {
            $feeCalculationBtn.prop("disabled", true);
        } else {
            $feeCalculationBtn.prop("disabled", false);
        }

		var context = {
			labelText: "Finish Height",
			labelI18n: "finish_height",
			helpI18n: "approve_transaction_finish_height_help",
			inputName: "phasingFinishHeight",
			phasingType: "advanced",
			initBlockHeight: NRS.lastBlockHeight + 1440,
			changeHeightBlocks: 60
		};
		NRS.initModalUIElement($modal, '.phasing_finish_height_group', 'block_height_modal_ui_element', context);
		context.phasingType = "mandatory_approval";
		NRS.initModalUIElement($modal, '.mandatory_approval_finish_height_group', 'block_height_modal_ui_element', context);

		context = {
			labelText: "Amount",
			labelI18n: "amount_nxt",
			helpI18n: "approve_transaction_amount_help",
			inputName: "phasingQuorumNXT",
			addonText: NRS.getActiveChainName(),
			addonI18n: "nxt_unit"
		};
		var $elems = NRS.initModalUIElement($modal, '.approve_transaction_amount_nxt', 'simple_input_with_addon_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);

		context = {
			labelText: "Asset Quantity",
			labelI18n: "asset_quantity",
			helpI18n: "approve_transaction_amount_help",
			inputName: "phasingQuorumQNTf",
			addonText: "Quantity",
			addonI18n: "quantity"
		};
		$elems = NRS.initModalUIElement($modal, '.approve_transaction_asset_quantity', 'simple_input_with_addon_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);

		context = {
			labelText: "Currency Units",
			labelI18n: "currency_units",
			helpI18n: "approve_transaction_amount_help",
			inputName: "phasingQuorumQNTf",
			addonText: "Units",
			addonI18n: "units"
		};
		$elems = NRS.initModalUIElement($modal, '.approve_transaction_currency_units', 'simple_input_with_addon_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);

		context = {
			labelText: "Accounts (Whitelist)",
			labelI18n: "accounts_whitelist",
			helpI18n: "approve_transaction_accounts_requested_help",
			inputName: "phasingWhitelisted"
		};
		$elems = NRS.initModalUIElement($modal, '.add_approval_whitelist_group', 'multi_accounts_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);

		context = {
			labelText: "PIECES",
			labelI18n: "pieces",
			helpI18n: "pieces_requested_help",
			inputName: "piece"
		};
		$elems = NRS.initModalUIElement($modal, '.piece_entry_group', 'multi_piece_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);

		context = {
			labelText: "Min Balance Type",
			labelI18n: "min_balance_type",
			helpI18n: "approve_transaction_min_balance_type_help",
			selectName: "phasingMinBalanceModel"
		};
		$elems = NRS.initModalUIElement($modal, '.approve_min_balance_model_group', 'min_balance_model_modal_ui_element', context);
		$elems.find('select').prop("disabled", true);

		$elems.each(function() {
			var $mbGroup = $(this).closest('div.approve_min_balance_model_group');
			if ($mbGroup.hasClass("approve_mb_balance")) {
				$mbGroup.find('option[value="2"], option[value="3"]').remove();
			}
			if ($mbGroup.hasClass("approve_mb_asset")) {
				$mbGroup.find('option[value="1"], option[value="3"]').remove();
			}
			if ($mbGroup.hasClass("approve_mb_currency")) {
				$mbGroup.find('option[value="1"], option[value="2"]').remove();
			}
		});

		context = {
			labelText: "Min Balance",
			labelI18n: "min_balance",
			helpI18n: "approve_transaction_min_balance_help",
			inputName: "",
			addonText: "",
			addonI18n: ""
		};
		context['inputName'] = 'phasingMinBalanceNXT';
		context['addonText'] = NRS.getActiveChainName();
		context['addonI18n'] = 'nxt_unit';
		$elems = NRS.initModalUIElement($modal, '.approve_min_balance_nxt', 'simple_input_with_addon_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);
		$elems.hide();

		context['inputName'] = 'phasingMinBalanceQNTf';
		context['addonText'] = 'Quantity';
		context['addonI18n'] = 'quantity';
		$elems = NRS.initModalUIElement($modal, '.approve_min_balance_asset_quantity', 'simple_input_with_addon_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);
		$elems.hide();

		context['inputName'] = 'phasingMinBalanceQNTf';
		context['addonText'] = 'Units';
		context['addonI18n'] = 'units';
		$elems = NRS.initModalUIElement($modal, '.approve_min_balance_currency_units', 'simple_input_with_addon_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);
		$elems.hide();

		context = {
			labelText: "Asset",
			labelI18n: "asset",
			inputIdName: "phasingHolding",
			inputDecimalsName: "phasingHoldingDecimals",
			helpI18n: "add_asset_modal_help"
		};
		$elems = NRS.initModalUIElement($modal, '.approve_holding_asset', 'add_asset_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);
		$elems = NRS.initModalUIElement($modal, '.approve_holding_asset_optional', 'add_asset_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);
		$elems.hide();

		context = {
			labelText: "Currency",
			labelI18n: "currency",
			inputCodeName: "phasingHoldingCurrencyCode",
			inputIdName: "phasingHolding",
			inputDecimalsName: "phasingHoldingDecimals",
			helpI18n: "add_currency_modal_help"
		};
		$elems = NRS.initModalUIElement($modal, '.approve_holding_currency', 'add_currency_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);
		$elems = NRS.initModalUIElement($modal, '.approve_holding_currency_optional', 'add_currency_modal_ui_element', context);
		$elems.find('input').prop("disabled", true);

		var selectName = $modal.attr('id') == "hash_modal" ? "hashAlgorithm" : "phasingHashedSecretAlgorithm";
		context = {
			labelText: "HASH ALGORITHM",
			labelI18n: "hash_algorithm",
			selectName: selectName
		};
		NRS.initModalUIElement($modal, '.hash_algorithm_model_group', 'hash_algorithm_model_modal_ui_element', context);

		context = {
			labelText: "PHASING APPROVAL MODEL",
			labelI18n: "phasing_approval_model",
			selectName: "phasingApprovalModel"
		};
		NRS.initModalUIElement($modal, '.phasing_model_group', 'approval_model_modal_ui_element', context);

		context = {
			labelText: "CONTROL APPROVAL MODEL",
			labelI18n: "control_approval_model",
			selectName: "controlApprovalModel"
		};
		NRS.initModalUIElement($modal, '.control_model_group', 'approval_model_modal_ui_element', context);

        $modal.one('shown.bs.modal', function() {
            NRS.setupModalMandatoryApproval($modal);
        });
	};

    NRS.setupModalMandatoryApproval = function($modal) {
        var requestType = $modal.find('input[name="request_type"]').val();
        var hasAccountControl = requestType != "approveTransaction" && NRS.hasAccountControl();
        if (requestType == "orderAsset") {
            requestType = $modal.find('input[name="asset_order_type"]').val();
        }
        var hasAssetControl = NRS.isSubjectToAssetControl(requestType);
        if (hasAccountControl && hasAssetControl
                && (NRS.accountInfo.phasingOnly.controlParams.phasingVotingModel == 6
                    || NRS.getCurrentAssetControl().phasingVotingModel == 6)) {
            //If both asset and account control are set, and if one or both requires composite phasing,
            //it is not trivial to build phasing parameters that satisfy both controls. So require the user to
            //do this manually
            $modal.find('.advanced_mandatory_approval input').prop('disabled', true);
            $modal.find('.advanced_mandatory_approval').show();
            $modal.find('.phasing_finish_height_group input').prop('disabled', false);
            $modal.find('#auto_phasing_possible_group').hide();
            $modal.find('#auto_phasing_not_possible_group').show();
        } else if (hasAccountControl || hasAssetControl) {
            $modal.find('.advanced_mandatory_approval input').prop('disabled', false);
            $modal.find('.advanced_mandatory_approval').show();
            $modal.find('.phasing_finish_height_group input').prop('disabled', true);
            $modal.find('#auto_phasing_possible_group').show();
            $modal.find('#auto_phasing_not_possible_group').hide();

            if (hasAccountControl) {
                $modal.find('#account_control_enabled_info').show();
                $modal.find('#account_control_details_link').show();
                $modal.find('#asset_control_enabled_info').hide();
            } else {
                $modal.find('#account_control_enabled_info').hide();
                $modal.find('#account_control_details_link').hide();
                $modal.find('#asset_control_enabled_info').show();
            }
        } else {
            $modal.find('.advanced_mandatory_approval input').prop('disabled', true);
            $modal.find('.advanced_mandatory_approval').hide();
            $modal.find('.phasing_finish_height_group input').prop('disabled', false);
        }
	};

	$('.approve_tab_list a[data-toggle="tab"]').on('shown.bs.tab', function () {
        var $am = $(this).closest('.approve_modal');
        $am.find('.tab-pane input, .tab-pane select').prop('disabled', true);
        $am.find('.tab-pane.active input, .tab-pane.active select').prop('disabled', false);
        if ($(this).hasClass("at_no_approval")) {
			$am.find('.approve_whitelist_accounts').hide();
        	$am.find('.approve_whitelist_accounts input').prop('disabled', true);
        } else {
        	$am.find('.approve_whitelist_accounts input').prop('disabled', false);
        	$am.find('.approve_whitelist_accounts').show();
        }
        $('.modal .approve_modal .approve_min_balance_model_group:visible select').trigger('change');

        $('li.show_popover').popover('hide');
    });

	$('body').on('change', '.modal .approve_modal .approve_min_balance_model_group select', function() {
		var $tabPane = $(this).closest('div.tab_pane_approve');
		var mbModelId = $(this).val();
		for(var id=0; id<=3; id++) {
			$tabPane.find('.approve_mb_model_' + String(id) + ' input').attr('disabled', true);
			$tabPane.find('.approve_mb_model_' + String(id)).hide();
		}
		$tabPane.find('.approve_mb_model_' + String(mbModelId) + ' input').attr('disabled', false);
		$tabPane.find('.approve_mb_model_' + String(mbModelId)).show();
	});

    var transactionJSONModal = $("#transaction_json_modal");
    transactionJSONModal.on("show.bs.modal", function(e) {
		$(this).find(".output").hide();
        $(this).find(".upload_container").hide();
		$(this).find("#unsigned_transaction_bytes_reader").hide();
		$(this).find(".tab_content:first").show();
        $("#transaction_json_modal_button").text($.t("sign_transaction")).data("resetText", $.t("sign_transaction")).data("form", "sign_transaction_form");
		var $invoker = $(e.relatedTarget);
		var isOffline = !!$invoker.data("offline");
		if (isOffline) {
			$(this).find("ul.nav li").hide();
			$(this).find("ul.nav li:first").show();
			$("#validate_transaction").prop("disabled", "true");
			$(".mobile-offline").val("true");
		}
	});

    transactionJSONModal.on("hidden.bs.modal", function() {
        NRS.stopScanQRCode();
        $(this).find(".tab_content").hide();
		$(this).find("ul.nav li.active").removeClass("active");
		$(this).find("ul.nav li:first").addClass("active");
		$(this).find(".output").hide();
	});

    transactionJSONModal.find("ul.nav li").click(function(e) {
		e.preventDefault();
		var tab = $(this).data("tab");
		$(this).siblings().removeClass("active");
		$(this).addClass("active");
		$(this).closest(".modal").find(".tab_content").hide();
		if (tab == "broadcast_json") {
			$("#transaction_json_modal_button").text($.t("broadcast")).data("resetText", $.t("broadcast")).data("form", "broadcast_json_form");
		} else if(tab == "parse_transaction") {
			$("#transaction_json_modal_button").text($.t("parse_transaction")).data("resetText", $.t("parse_transaction")).data("form", "parse_transaction_form");
		} else if(tab == "calculate_full_hash") {
			$("#transaction_json_modal_button").text($.t("calculate_full_hash")).data("resetText", $.t("calculate_full_hash")).data("form", "calculate_full_hash_form");
		} else {
			$("#transaction_json_modal_button").text($.t("sign_transaction")).data("resetText", $.t("sign_transaction")).data("form", "sign_transaction_form");
		}
		$("#transaction_json_modal_" + tab).show();
	});

	NRS.forms.broadcastTransactionComplete = function() {
		$("#parse_transaction_form").find(".error_message").hide();
        $("#transaction_json_modal").modal("hide");
	};

	NRS.forms.parseTransactionComplete = function(response) {
		$("#parse_transaction_form").find(".error_message").hide();
        var details = $.extend({}, response);
        details = NRS.flattenObject(details, ["version.", "signature"], ["RS"]);
        $("#parse_transaction_output_table").find("tbody").empty().append(NRS.createInfoTable(details, { fixed: true }));
        $("#parse_transaction_output").show();
	};

	NRS.forms.parseTransactionError = function() {
		$("#parse_transaction_output_table").find("tbody").empty();
		$("#parse_transaction_output").hide();
	};

	NRS.forms.calculateFullHashComplete = function(response) {
		$("#calculate_full_hash_form").find(".error_message").hide();
		$("#calculate_full_hash_output_table").find("tbody").empty().append(NRS.createInfoTable(response, { fixed: true }));
		$("#calculate_full_hash_output").show();
	};

	NRS.forms.calculateFullHashError = function() {
		$("#calculate_full_hash_output_table").find("tbody").empty();
		$("#calculate_full_hash_output").hide();
	};

    NRS.forms.broadcastTransactionComplete = function() {
   		$("#parse_transaction_form").find(".error_message").hide();
   		$("#transaction_json_modal").modal("hide");
   	};

	function updateSignature(signature) {
		$("#transaction_signature").val(signature);
		NRS.generateQRCode("#transaction_signature_qr_code", signature, 8);
		$("#signature_output").show();
	}

	NRS.forms.signTransactionComplete = function(response) {
        $("#sign_transaction_form").find(".error_message").hide();
        var signedTransactionJson = $("#signed_transaction_json");
        var jsonStr = JSON.stringify(response.transactionJSON);
        signedTransactionJson.val(jsonStr);
        var downloadLink = $("#signed_transaction_json_download");
        if (window.URL && NRS.isFileReaderSupported()) {
            var jsonAsBlob = new Blob([jsonStr], {type: 'text/plain'});
            downloadLink.prop('download', 'signed.transaction.' + response.transactionJSON.timestamp + '.json');
            try {
                downloadLink.prop('href', window.URL.createObjectURL(jsonAsBlob));
			} catch(e) {
            	NRS.logConsole("Desktop Application in Java 8 does not support createObjectURL");
                downloadLink.hide();
			}
        } else {
            downloadLink.hide();
        }
        $("#signed_json_output").show();
		updateSignature(response.transactionJSON.signature);
    };

    NRS.forms.signTransaction = function() {
        var data = NRS.getFormData($("#sign_transaction_form"));
		if (data.unsignedTransactionBytes && !data.validate) {
			NRS.logConsole("Sign transaction locally");
			var output = {};
			var secretPhrase = (NRS.rememberPassword ? _password : data.secretPhrase);
			var isOffline = $(".mobile-offline").val();
            var accountId = NRS.getAccountId(secretPhrase, true);
            if (accountId == NRS.accountRS || isOffline) {
				try {
					var signature = NRS.signBytes(data.unsignedTransactionBytes, converters.stringToHexString(secretPhrase));
					updateSignature(signature);
				} catch (e) {
					output.errorMessage = e.message;
				}
			} else {
				output.errorMessage = $.t("error_passphrase_incorrect_v2", { account: accountId });
			}
			output.stop = true;
			output. keepOpen = true;
			return output;
		}
        data.validate = (data.validate ? "true" : "false");
        return { data: data };
    };

    return NRS;
}(NRS || {}, jQuery));
