"use strict";
var KTSigninGeneral = function () {
    var e, t, i;
    return {
        init: function () {
            e = document.querySelector("#kt_sign_in_form"), t = document.querySelector("#kt_sign_in_submit"), i = FormValidation.formValidation(e, {
                fields: {
                    email: {
                        validators: {
                            notEmpty: {
                                message: "Email address is required"
                            },
                            emailAddress: {
                                message: "The value is not a valid email address"
                            }
                        }
                    },
                    password: {
                        validators: {
                            notEmpty: {
                                message: "The password is required"
                            },
                            callback: {
                                message: "Please enter valid password",
                                callback: function (e) {
                                    if (e.value.length > 0) return _validatePassword()
                                }
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
            }), t.addEventListener("click", (function (n) {
                n.preventDefault();
                i.validate().then((function (i) {
                    if (i === "Valid") {
                        t.setAttribute("data-kt-indicator", "on");
                        t.disabled = true;
                        
                            if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(function(position) {
                                    passError.textContent = ""
                                    emailError.textContent = ""
                                    const formData = new FormData(e)
                                    const data = new URLSearchParams();
                                    for (const pair of formData) {
                                        data.append(pair[0], pair[1]);
                                       
                                    }
                                    data.append('latitude', position.coords.latitude);
                                    data.append('longitude', position.coords.longitude);
                                    // Send the form data to the server
                                    fetch("/login", {
                                        method: "POST",
                                        headers: {
                                            'Content-Type': 'application/x-www-form-urlencoded'
                                        },
                                        body: data
                                    }).then((data) => {
                                        if (data.status === 400) {
                
                                            return data.json().then((message) => {
                                                Swal.fire({
                                                    text: message.message,
                                                    icon: "error",
                                                    buttonsStyling: !1,
                                                    confirmButtonText: "Ok, got it!",
                                                    customClass: {
                                                        confirmButton: "btn btn-primary"
                                                    }
                                                }).then((response)=> {
                                                    if(response.isConfirmed) {
                                                        t.setAttribute("data-kt-indicator", "off")
                                                        t.disabled = 0
            
                                                        const emailError = document.getElementById("emailError")
                                                        const passError = document.getElementById("passError")
                                                        if(message.type === "email") {
                                                            emailError.textContent = message.message
                                                        } 
            
                                                        if(message.type === "pass") {
                                                            passError.textContent = message.message
                                                        } 

                                                        if(message.type === "location") {
                                                            Swal.fire({
                                                                text: message.message,
                                                                icon: "error",
                                                                buttonsStyling: !1,
                                                                confirmButtonText: "Ok, got it!",
                                                                customClass: {
                                                                    confirmButton: "btn btn-primary"
                                                                }
                                                            })
                                                        }
                                                    }
                                                })
                                            })
                
                                        } else if (data.status === 302) {
                                         
                                                return data.json().then((backData)=> {
                                                    window.location.href = "/two-factor/sms?mobileNumber="+backData.mobile+"&email="+backData.email
                                                })
                                       
                                        } else if (data.status === 200) {
                                         
                                         window.location.href="/dashboard"
                                   
                                    } else if (data.status === 401) {
                                            Swal.fire({
                                                text: "You are not authorized to perform this action",
                                                icon: "error",
                                                buttonsStyling: !1,
                                                confirmButtonText: "Ok, got it!",
                                                customClass: {
                                                    confirmButton: "btn btn-primary"
                                                }
                                            }).then((data) => {
                                                if (data.isConfirmed) {
                                                    t.setAttribute("data-kt-indicator", "off")
                                                    t.disabled = 0
                                                }
                                            })
                                        }
                                    })
                                }, function(error) {
                                    alert('Error occurred. Error code: ' + error.code);
                                });
                            } else {
                                alert("Geolocation is not supported by this browser.");
                            }

                           
                 
                    } else {
                        Swal.fire({
                            // Swal.fire() options here
                        });
                    }
                }));
            }))
        }
    }
}();
KTUtil.onDOMContentLoaded((function () {
    KTSigninGeneral.init()
   
}));