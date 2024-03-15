"use strict";
var KTUsersUpdateUser = function() {
    const t = document.getElementById("kt_modal_add_user"),
        e = t.querySelector("#newVehicle"),
        n = new bootstrap.Modal(t);
    return {
        init: function() {
            (() => {
                var o = FormValidation.formValidation(e, {
                    fields: {
                        vehicleNumber: {
                            validators: {
                                notEmpty: {
                                    message: "Vehicle Number is Required"
                                }
                            }
                        },
                        vehicleType: {
                            validators: {
                                notEmpty: {
                                    message: "Vehicle Type is Required"
                                }
                            }
                        },permitValidity: {
                            validators: {
                                notEmpty: {
                                    message: "Permit Validity is Required"
                                }
                            }
                        },insuaranceValidity: {
                            validators: {
                                notEmpty: {
                                    message: "Insuarance Valdiity is Required"
                                }
                            }
                        },owner: {
                            validators: {
                                notEmpty: {
                                    message: "Selecting Vehicle Owner is Mandatory"
                                }
                            }
                        },driver: {
                            validators: {
                                notEmpty: {
                                    message: "Selecting Driver For Vehicle is Required"
                                }
                            }
                        }
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
                const i = t.querySelector('[data-kt-users-modal-action="update"]');
                i.addEventListener("click", (t => {
                    t.preventDefault(), o && o.validate().then((function(t) {
                        console.log("validated!"), "Valid" == t ? (i.setAttribute("data-kt-indicator", "on"), i.disabled = !0, setTimeout((function() {
                           
                           
                            const data = new URLSearchParams();
                            for (const pair of new FormData(e)) {
                               data.append(pair[0], pair[1]);
                            }
                            fetchPostRequest("/masters/vehicles/edit", data, "Vehicle Updated Successfully", i)
                           
                        }), )) : Swal.fire({
                            text: "Please fill all required fields",
                            icon: "error",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        })
                    }))
                })), t.querySelector('[data-kt-users-modal-action="cancel"]').addEventListener("click", (t => {
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
                })), t.querySelector('[data-kt-users-modal-action="close"]').addEventListener("click", (t => {
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
                }))
            })()
        }
    }
}();
KTUtil.onDOMContentLoaded((function() {
    KTUsersUpdateUser.init()
}));