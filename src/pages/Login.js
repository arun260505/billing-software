const handleSubmit = async (e) => {

    e.preventDefault();

    try {

        const response = await authService.login(form);

        console.log("Login Response:", response);
        localStorage.setItem("token", response.data.token);
localStorage.setItem("user", JSON.stringify(response.data.user));

            switch (response.user.role) {

            case "super_admin":
                navigate("/super_admin");
                break;

            case "admin":
                navigate("/admin/dashboard");
                break;

            case "cashier":
                navigate("/cashier");
                break;

            case "waiter":
                navigate("/waiter");
                break;

            case "kitchen":
                navigate("/kitchen");
                break;

            default:
                navigate("/");
        }

    } catch (err) {

        setError(
            err.response?.data?.message || "Login failed."
        );

    }

};