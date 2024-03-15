"use strict";
var KTModalTwoFactorAuthentication = function () {
    var e, t, o, n, i, a, r, s, l, d, c, u, m, f, p = function () {
        o.classList.remove("d-none"), i.classList.add("d-none"), d.classList.add("d-none")
    };
    return {
        init: function () {
            (e = document.querySelector("#kt_modal_two_factor_authentication")) && (t = new bootstrap.Modal(e), o = e.querySelector('[data-kt-element="options"]'), n = e.querySelector('[data-kt-element="options-select"]'), i = e.querySelector('[data-kt-element="sms"]'), a = e.querySelector('[data-kt-element="sms-form"]'), r = e.querySelector('[data-kt-element="sms-submit"]'), s = e.querySelector('[data-kt-element="sms-cancel"]'), d = e.querySelector('[data-kt-element="apps"]'), c = e.querySelector('[data-kt-element="apps-form"]'), u = e.querySelector('[data-kt-element="apps-submit"]'), m = e.querySelector('[data-kt-element="apps-cancel"]'), n.addEventListener("click", (function (e) {
                e.preventDefault();
                var t = o.querySelector('[name="auth_option"]:checked');
                o.classList.add("d-none"), "sms" == t.value ? i.classList.remove("d-none") : d.classList.remove("d-none")
            })), l = FormValidation.formValidation(a, {
                fields: {
                    mobile: {
                        validators: {
                            notEmpty: {
                                message: "Mobile no is required"
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
            }), r.addEventListener("click", (function (e) {
                e.preventDefault(), l && l.validate().then((function (e) {
                    console.log("validated!"), "Valid" == e ? (r.setAttribute("data-kt-indicator", "on"), r.disabled = !0, setTimeout((function () {
                        const smsFORM = document.getElementById("enableTwoFactorSms")
                        const data = new URLSearchParams();
                        for (const pair of new FormData(smsFORM)) {
                            data.append(pair[0], pair[1]);
                        }
                        fetch("/profile/security/sms", {
                            method: "POST",
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: data
                        }).then((data)=> {
                            if(data.status === 200) {
                                return data.json().then((backData)=> {
                                    Swal.fire({
                                        text: "OTP Sent successfuly",
                                        icon: "success",
                                        buttonsStyling: !1,
                                        confirmButtonText: "Ok, got it!",
                                        customClass: {
                                            confirmButton: "btn btn-primary"
                                        }
                                    }).then((response)=>{
                                        if(response.isConfirmed) {
                                           window.location.href = "/profile/security/sms/verify?mobileNumber="+backData.mobile
                                        }
                                    })
                                })
                            } else if(data.status === 400) {
                              return data.json().then((backData)=> { 
                                Swal.fire({
                                    text: backData.message,
                                    icon: "error",
                                    buttonsStyling: !1,
                                    confirmButtonText: "Ok, got it!",
                                    customClass: {
                                        confirmButton: "btn btn-primary"
                                    }
                                }).then((response)=> {
                                    if(response.isConfirmed) {
                                        r.setAttribute("data-kt-indicator", "off")
                                            r.disabled = false
                                    }
                                })

                               })
                            } else if(data.status === 500) {
                                alert("SOMETHING WENT WRONG")
                            }
                        })
                    }

                    ),)) : Swal.fire({
                        text: "Sorry, looks like there are some errors detected, please try again.",
                        icon: "error",
                        buttonsStyling: !1,
                        confirmButtonText: "Ok, got it!",
                        customClass: {
                            confirmButton: "btn btn-primary"
                        }
                    })
                }))
            })), s.addEventListener("click", (function (e) {
                e.preventDefault(), o.querySelector('[name="auth_option"]:checked'), o.classList.remove("d-none"), i.classList.add("d-none")
            })), f = FormValidation.formValidation(c, {
                fields: {
                    code: {
                        validators: {
                            notEmpty: {
                                message: "Code is required"
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
            }), u.addEventListener("click", (function (e) {
                e.preventDefault(), f && f.validate().then((function (e) {
                    console.log("validated!"), "Valid" == e ? (u.setAttribute("data-kt-indicator", "on"), u.disabled = !0, setTimeout((function () {
                        u.removeAttribute("data-kt-indicator"), u.disabled = !1, Swal.fire({
                            text: "Code has been successfully submitted!",
                            icon: "success",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        }).then((function (e) {
                            e.isConfirmed && (t.hide(), p())
                        }))
                    }), 2e3)) : Swal.fire({
                        text: "Sorry, looks like there are some errors detected, please try again.",
                        icon: "error",
                        buttonsStyling: !1,
                        confirmButtonText: "Ok, got it!",
                        customClass: {
                            confirmButton: "btn btn-primary"
                        }
                    })
                }))
            })), m.addEventListener("click", (function (e) {
                e.preventDefault(), o.querySelector('[name="auth_option"]:checked'), o.classList.remove("d-none"), d.classList.add("d-none")
            })))
        }
    }
}();
KTUtil.onDOMContentLoaded((function () {
    KTModalTwoFactorAuthentication.init()
}));

