"use strict";
var KTAccountSettingsSigninMethods = function() {
    var t, e, n, o, i, s, r, a, l, d = function() {
            e.classList.toggle("d-none"), s.classList.toggle("d-none"), n.classList.toggle("d-none")
        },
        c = function() {
            o.classList.toggle("d-none"), a.classList.toggle("d-none"), i.classList.toggle("d-none")
        };
    return {
        init: function() {
            var m;
            t = document.getElementById("kt_signin_change_email"), e = document.getElementById("kt_signin_email"), n = document.getElementById("kt_signin_email_edit"), o = document.getElementById("kt_signin_password"), i = document.getElementById("kt_signin_password_edit"), s = document.getElementById("kt_signin_email_button"), r = document.getElementById("kt_signin_cancel"), a = document.getElementById("kt_signin_password_button"), l = document.getElementById("kt_password_cancel"), e && (s.querySelector("button").addEventListener("click", (function() {
                    d()
                })), r.addEventListener("click", (function() {
                    d()
                })), a.querySelector("button").addEventListener("click", (function() {
                    c()
                })), l.addEventListener("click", (function() {
                    c()
                }))), t && (m = FormValidation.formValidation(t, {
                    fields: {
                        emailaddress: {
                            validators: {
                                notEmpty: {
                                    message: "Email is required"
                                },
                                emailAddress: {
                                    message: "The value is not a valid email address"
                                }
                            }
                        },
                        confirmemailpassword: {
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
                            rowSelector: ".fv-row"
                        })
                    }
                }), t.querySelector("#kt_signin_submit").addEventListener("click", (function(e) {
                            const changeForm = document.getElementById("kt_signin_change_email")
                            const data = new URLSearchParams();
                            for (const pair of new FormData(changeForm)) {
                               data.append(pair[0], pair[1]);
                            }
                            fetch("/profile/security/change-email", {
                                method: "POST",
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                body: data
                            }).then((data)=> {
                                if(data.status === 400) {
                                    return data.json().then((response)=> {
                                        swal.fire({
                                            text: response.message,
                                            icon: "error",
                                            buttonsStyling: !1,
                                            confirmButtonText: "Ok, got it!",
                                            customClass: {
                                                confirmButton: "btn font-weight-bold btn-light-primary"
                                            }
                                        })
                                    })
                                } else if(data.status === 200) {
                                    swal.fire({
                                        text: "Email Updated Successfully",
                                        icon: "success",
                                        buttonsStyling: !1,
                                        confirmButtonText: "Ok, got it!",
                                        customClass: {
                                            confirmButton: "btn font-weight-bold btn-light-primary"
                                        }
                                    }).then((data)=> {
                                        if(data.isConfirmed) {
                                            
                                            location.reload()
                                        }
                                    })
                                }
                            })

                }))),
                function(t) {
                    var e, n = document.getElementById("kt_signin_change_password");
                    n && (e = FormValidation.formValidation(n, {
                        fields: {
                            currentpassword: {
                                validators: {
                                    notEmpty: {
                                        message: "Current Password is required"
                                    }
                                }
                            },
                            newpassword: {
                                validators: {
                                    notEmpty: {
                                        message: "New Password is required"
                                    },
                                    stringLength :{
                                        min : 8,
                                        message : "Password Should be minimum 8 characters long"
                                    }
                                }
                            },
                            confirmpassword: {
                                validators: {
                                    notEmpty: {
                                        message: "Confirm Password is required"
                                    },
                                    identical: {
                                        compare: function() {
                                            return n.querySelector('[name="newpassword"]').value
                                        },
                                        message: "The password and its confirm are not the same"
                                    }
                                }
                            }
                        },
                        plugins: {
                            trigger: new FormValidation.plugins.Trigger,
                            bootstrap: new FormValidation.plugins.Bootstrap5({
                                rowSelector: ".fv-row"
                            })
                        }
                    }), n.querySelector("#kt_password_submit").addEventListener("click", (function(t) {
                        const changeForm = document.getElementById("kt_signin_change_password")
                        const data = new URLSearchParams();
                            for (const pair of new FormData(changeForm)) {
                               data.append(pair[0], pair[1]);
                            }
                            fetch("/profile/security/change-password", {
                                method: "POST",
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                body: data
                            }).then((data)=> {
                                if(data.status === 400) {
                                    return data.json().then((data)=> {
                                        swal.fire({
                                            text: data.message,
                                            icon: "error",
                                            buttonsStyling: !1,
                                            confirmButtonText: "Ok, got it!",
                                            customClass: {
                                                confirmButton: "btn font-weight-bold btn-light-primary"
                                            }
                                        })
                                    })
                                } else if(data.status === 200 ) {
                                    swal.fire({
                                        text: "Password Updated Successfully",
                                        icon: "success",
                                        buttonsStyling: !1,
                                        confirmButtonText: "Ok, got it!",
                                        customClass: {
                                            confirmButton: "btn font-weight-bold btn-light-primary"
                                        }
                                    }).then((data)=> {
                                        if(data.isConfirmed) {
                                            location.reload()
                                        }
                                    })
                                } else if(data.status === 500) {
                                    alert("Something Went Wrong")
                                }
                            })
                    })))
                }()
        }
    }
}();
KTUtil.onDOMContentLoaded((function() {
    KTAccountSettingsSigninMethods.init()
}));