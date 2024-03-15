// To Edit State Name


"use strict";
var KTUsersUpdatePermission = function() {
    const t = document.getElementById("kt_modal_update_permission"),
        e = t.querySelector("#editVehicleOwnerForm"),
        n = new bootstrap.Modal(t);
    return {
        init: function() {
            (() => {
                var o = FormValidation.formValidation(e, {
                    fields: {
                        name: {
                            validators: {
                                notEmpty: {
                                    message: "Vehicle Owner Name is required"
                                }
                            }
                        },
                        address: {
                            validators : {
                                notEmpty : {
                                    message : "Vehicle Owner Address is required"
                                }
                            }
                        },
                        city : {
                            validators : {
                                notEmpty : {
                                    message : "Vehicle Owner City is required"
                                }
                            }
                        
                        },
                        state : {
                            validators : {
                                notEmpty : {
                                    message : "Vehicle Owner State is required"
                                }
                            }
                        },
                        
                    },
                    plugins: {
                        trigger: new FormValidation.plugins.Trigger,
                        bootstrap: new FormValidation.plugins.Bootstrap5({
                            rowSelector: ".fv-row",
                            eleInvalidClass: "",
                            eleValidClass: ""
                        })
                    }
                });
                t.querySelector('[data-kt-permissions-modal-action="close"]').addEventListener("click", (t => {
                    t.preventDefault(), Swal.fire({
                        text: "Are you sure you would like to close?",
                        icon: "warning",
                        showCancelButton: !0,
                        buttonsStyling: !1,
                        confirmButtonText: "Yes, close it!",
                        cancelButtonText: "No, return",
                        customClass: {
                            confirmButton: "btn btn-primary",
                            cancelButton: "btn btn-active-light"
                        }
                    }).then((function(t) {
                        t.value && n.hide()
                    }))
                })), t.querySelector('[data-kt-permissions-modal-action="cancel"]').addEventListener("click", (t => {
                    t.preventDefault(), Swal.fire({
                        text: "Are you sure you would like to cancel?",
                        icon: "warning",
                        showCancelButton: !0,
                        buttonsStyling: !1,
                        confirmButtonText: "Yes, cancel it!",
                        cancelButtonText: "No, return",
                        customClass: {
                            confirmButton: "btn btn-primary",
                            cancelButton: "btn btn-active-light"
                        }
                    }).then((function(t) {
                        t.value ? (e.reset(), n.hide()) : "cancel" === t.dismiss && Swal.fire({
                            text: "Your form has not been cancelled!.",
                            icon: "error",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        })
                    }))
                }));
                const i = t.querySelector('[data-kt-permissions-modal-action="submit"]');
                i.addEventListener("click", (function(t) {
                    t.preventDefault(), o && o.validate().then((function(t) {
                        console.log("validated!"), "Valid" == t ? (i.setAttribute("data-kt-indicator", "on"), i.disabled = !0, setTimeout((function() {
                            
                            const data = new URLSearchParams();
                            for (const pair of new FormData(e)) {
                                data.append(pair[0], pair[1]);
                            }
                            fetchPostRequest(`/masters/vehicles/owners/edit`, data, "Vehicle Owner Successfully", $('[data-kt-permissions-modal-action="submit"]'))
                

                        }),)) : Swal.fire({
                            text: "Please Fill all Required Fields",
                            icon: "error",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        })
                    }))
                }))
            })()
        }
    }
}();
KTUtil.onDOMContentLoaded((function() {
    KTUsersUpdatePermission.init()
}));