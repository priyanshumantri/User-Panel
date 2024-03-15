"use strict";
var KTCreateAccount = function () {
    var e, t, i, o, a, r, s = [];
    return {
        init: function () {
            (e = document.querySelector("#kt_modal_create_account")) && new bootstrap.Modal(e), (t = document.querySelector("#kt_create_account_stepper")) && (i = t.querySelector("#kt_create_account_form"), o = t.querySelector('[data-kt-stepper-action="submit"]'), a = t.querySelector('[data-kt-stepper-action="next"]'), (r = new KTStepper(t)).on("kt.stepper.changed", (function (e) {
                4 === r.getCurrentStepIndex() ? (o.classList.remove("d-none"), o.classList.add("d-inline-block"), a.classList.add("d-none")) : 5 === r.getCurrentStepIndex() ? (o.classList.add("d-none"), a.classList.add("d-none")) : (o.classList.remove("d-inline-block"), o.classList.remove("d-none"), a.classList.remove("d-none"))
            })), r.on("kt.stepper.next", (function (e) {
                console.log("stepper.next");
                var t = s[e.getCurrentStepIndex() - 1];
                t ? t.validate().then((function (t) {
                    console.log("validated!"), "Valid" == t ? (e.goNext(), KTUtil.scrollTop()) : Swal.fire({
                        text: "Sorry, looks like there are some errors detected, please try again.",
                        icon: "error",
                        buttonsStyling: !1,
                        confirmButtonText: "Ok, got it!",
                        customClass: {
                            confirmButton: "btn btn-light"
                        }
                    }).then((function () {
                        KTUtil.scrollTop()
                    }))
                })) : (e.goNext(), KTUtil.scrollTop())
            })), r.on("kt.stepper.previous", (function (e) {
                console.log("stepper.previous"), e.goPrevious(), KTUtil.scrollTop()
            })), s.push(FormValidation.formValidation(i, {
                fields: {
                    email: {
                        validators: {
                            notEmpty: {
                                message: "Email is required"
                            }
                        }
                    },
                    firstName : {
                        validators: {
                            notEmpty : {
                                message : "First name is required"
                            }
                        }
                    },
                    lastName : {
                        validators: {
                            notEmpty : {
                                message : "Last name is required"
                            }
                        }
                    },
                    password: {
                        validators: {
                            notEmpty: {
                                message: "Password is required"
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
            })), s.push(FormValidation.formValidation(i, {
                fields: {
                    companyName: {
                        validators: {
                            notEmpty: {
                                message: "Company Name is required"
                            }
                        }
                    },
                    companyLogo: {
                        validators: {
                            notEmpty: {
                                message: "Company Logo is required"
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
            })), s.push(FormValidation.formValidation(i, {
                fields: {
                    secure: {
                        validators: {
                            notEmpty: {
                                message: "Secure is required"
                            }
                        }
                    },
                    port: {
                        validators: {
                            notEmpty: {
                                message: "Port is required"
                            }
                        }
                    },
                    host: {
                        validators: {
                            notEmpty: {
                                message: "Host is required"
                            }
                        }
                    },
                    smtpEmail: {
                        validators: {
                            notEmpty: {
                                message: "Email is required"
                            },
                            emailAddress: {
                                message: "The value is not a valid email address"
                            }
                        }
                    },
                    smtpPassword: {
                        validators: {
                            notEmpty: {
                                message: "Password is required"
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
            })), s.push(FormValidation.formValidation(i, {
                fields: {
                    defualtRegistrationProcessEmail: {
                        validators: {
                            notEmpty: {
                                message: "Email is required"
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
            })), o.addEventListener("click", (function (e) {
                s[3].validate().then((function (t) {
                    console.log("validated!"), "Valid" == t ? (e.preventDefault(), o.disabled = !0, o.setAttribute("data-kt-indicator", "on"), setTimeout((function () {

                        i.submit()


                    }),)) : Swal.fire({
                        text: "Sorry, looks like there are some errors detected, please try again.",
                        icon: "error",
                        buttonsStyling: !1,
                        confirmButtonText: "Ok, got it!",
                        customClass: {
                            confirmButton: "btn btn-light"
                        }
                    }).then((function () {
                        KTUtil.scrollTop()
                    }))
                }))
            }))

            )
        }
    }
}();
KTUtil.onDOMContentLoaded((function () {
    KTCreateAccount.init()
}));